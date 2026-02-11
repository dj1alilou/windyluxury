require("dotenv").config();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const cloudinary = require("cloudinary").v2;
const sharp = require("sharp");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for temporary uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// MongoDB Connection - Vercel Serverless compatible
let cachedClient = null;
let cachedDb = null;

// Only use environment variable, no fallback
const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  // Check if URI is available
  if (!MONGODB_URI) {
    console.log("MongoDB URI not configured");
    return null;
  }

  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  try {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    await client.connect();
    cachedClient = client;
    cachedDb = client.db("windyluxury");
    return cachedDb;
  } catch (err) {
    console.log("MongoDB connection failed:", err.message);
    return null;
  }
}

// Category ID mapping
const categoryNameToId = {
  Parure: "1",
  Bracelet: "2",
  Bague: "3",
  Boucles: "4",
  Montre: "5",
  Collier: "6",
};

async function compressToWebP(buffer) {
  try {
    const compressedBuffer = await sharp(buffer)
      .webp({ quality: 85 })
      .toBuffer();
    return compressedBuffer;
  } catch (error) {
    return buffer;
  }
}

async function uploadToCloudinary(buffer, folder = "windy-luxury") {
  try {
    const webpBuffer = await compressToWebP(buffer);
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: "image", format: "webp" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      uploadStream.end(webpBuffer);
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return null;
  }
}

async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
}

function defaultCategories() {
  return [
    { id: "1", name: "Parure", icon: "fas fa-layer-group" },
    { id: "2", name: "Bracelet", icon: "fas fa-band-aid" },
    { id: "3", name: "Bague", icon: "fas fa-ring" },
    { id: "4", name: "Boucles", icon: "fas fa-gem" },
    { id: "5", name: "Montre", icon: "fas fa-clock" },
    { id: "6", name: "Collier", icon: "fas fa-necklace" },
  ];
}

// Parse JSON body for serverless
function parseBody(req) {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
    return req.body;
  }
  return {};
}

// Vercel Serverless Handler
module.exports = async (req, res) => {
  const method = req.method;
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS headers for serverless
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Health check endpoints
    if (pathname === "/ping" && method === "GET") {
      return res.send("OK");
    }

    if (pathname === "/api/health" && method === "GET") {
      return res.json({ status: "ok", timestamp: new Date().toISOString() });
    }

    // ==================== CATEGORIES ====================

    if (pathname === "/api/categories" && method === "GET") {
      const database = await connectDB();
      if (database) {
        const categories = await database
          .collection("categories")
          .find()
          .toArray();
        return res.json(
          categories.length > 0 ? categories : defaultCategories(),
        );
      }
      return res.json(defaultCategories());
    }

    // ==================== PRODUCTS ====================

    if (pathname === "/api/products" && method === "GET") {
      const database = await connectDB();
      if (database) {
        const products = await database.collection("products").find().toArray();
        return res.json(products);
      }
      return res.json([]);
    }

    if (pathname === "/api/products" && method === "POST") {
      const database = await connectDB();

      // Parse product data - handle both JSON and FormData
      let productData = {};
      if (req.body && typeof req.body === "string") {
        productData = JSON.parse(req.body);
      } else if (req.body && req.body.product) {
        productData =
          typeof req.body.product === "string"
            ? JSON.parse(req.body.product)
            : req.body.product;
      } else {
        // Parse from FormData fields
        productData = {
          name: req.body?.name,
          title: req.body?.title || req.body?.name,
          category: req.body?.category,
          categoryId: req.body?.categoryId,
          price: parseFloat(req.body?.price) || 0,
          oldPrice: parseFloat(req.body?.oldPrice) || 0,
          stock: parseInt(req.body?.stock) || 0,
          description: req.body?.description,
          featured: req.body?.featured,
          status: req.body?.status || "active",
        };
      }

      // Map category name to ID if not provided
      if (productData.category && !productData.categoryId) {
        productData.categoryId = categoryNameToId[productData.category] || "";
      }

      // Handle images from multipart form
      const files = req.files || [];
      const images = [];

      for (const file of files) {
        const result = await uploadToCloudinary(
          file.buffer,
          "windy-luxury/products",
        );
        if (result) {
          images.push({
            url: result.url,
            publicId: result.publicId,
            format: result.format,
          });
        }
      }

      // Parse sizes if provided
      if (req.body?.sizes) {
        try {
          productData.sizes =
            typeof req.body.sizes === "string"
              ? JSON.parse(req.body.sizes)
              : req.body.sizes;
        } catch (e) {
          // Ignore size parsing errors
        }
      }

      const product = {
        id: Date.now().toString(),
        name: productData.name,
        title: productData.title || productData.name,
        category: productData.category,
        categoryId: productData.categoryId,
        price: productData.price || 0,
        oldPrice: productData.oldPrice || 0,
        stock: productData.stock || 0,
        description: productData.description,
        featured: productData.featured,
        status: productData.status || "active",
        sizes: productData.sizes,
        images: images.length > 0 ? images : undefined,
        image: images.length > 0 ? images[0].url : productData.image,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (database) {
        await database.collection("products").insertOne(product);
      }

      return res.status(201).json(product);
    }

    // PUT /api/products/:id
    if (pathname.match(/^\/api\/products\/.+$/) && method === "PUT") {
      const database = await connectDB();
      const id = pathname.split("/")[3];
      const productData = parseBody(req.body);
      const files = req.files || [];

      let existingProduct = null;
      if (database) {
        existingProduct = await database.collection("products").findOne({ id });
      }

      const newImages = [];
      for (const file of files) {
        const result = await uploadToCloudinary(
          file.buffer,
          "windy-luxury/products",
        );
        if (result) {
          newImages.push({
            url: result.url,
            publicId: result.publicId,
            format: result.format,
          });
        }
      }

      const existingImages = existingProduct?.images || [];
      const allImages = [...existingImages, ...newImages];

      const updatedProduct = {
        ...existingProduct,
        ...productData,
        images: allImages,
        image: allImages.length > 0 ? allImages[0].url : productData.image,
        updatedAt: new Date().toISOString(),
      };

      if (database) {
        await database
          .collection("products")
          .updateOne({ id }, { $set: updatedProduct });
      }

      return res.json(updatedProduct);
    }

    // DELETE /api/products/:id
    if (pathname.match(/^\/api\/products\/.+$/) && method === "DELETE") {
      const database = await connectDB();
      const id = pathname.split("/")[3];

      if (database) {
        const product = await database.collection("products").findOne({ id });
        if (product?.images) {
          for (const img of product.images) {
            if (img.publicId) await deleteFromCloudinary(img.publicId);
          }
        }
        await database.collection("products").deleteOne({ id });
      }

      return res.json({ success: true });
    }

    // ==================== ORDERS ====================

    if (pathname === "/api/orders" && method === "GET") {
      const database = await connectDB();
      if (database) {
        const orders = await database
          .collection("orders")
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        return res.json(orders);
      }
      return res.json([]);
    }

    if (pathname === "/api/orders" && method === "POST") {
      const database = await connectDB();
      const body = parseBody(req.body);

      // Validate required fields
      if (!body.customerName || !body.customerPhone) {
        return res.status(400).json({
          success: false,
          error: "customerName and customerPhone are required",
        });
      }

      const orderId =
        Date.now().toString() + Math.random().toString(36).substr(2, 5);

      const order = {
        orderId,
        id: orderId,
        ...body,
        status: body.status || "pending",
        items: body.items || body.products || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (database) {
        await database.collection("orders").insertOne(order);
      }

      return res.status(201).json(order);
    }

    // PUT /api/orders/:id/status
    if (pathname.match(/^\/api\/orders\/.+\/status$/) && method === "PUT") {
      const database = await connectDB();
      const id = pathname.split("/")[3];
      const body = parseBody(req.body);

      if (database) {
        await database.collection("orders").updateOne(
          { id },
          {
            $set: {
              status: body.status,
              updatedAt: new Date().toISOString(),
            },
          },
        );
      }

      return res.json({ success: true });
    }

    // GET /api/orders/export/zrexpress
    if (pathname === "/api/orders/export/zrexpress" && method === "GET") {
      const database = await connectDB();
      const ids = url.searchParams.get("ids");
      let orders = [];

      if (database) {
        if (ids) {
          const idList = ids.split(",");
          orders = await database
            .collection("orders")
            .find({ id: { $in: idList }, status: { $ne: "cancelled" } })
            .sort({ createdAt: -1 })
            .toArray();
        } else {
          orders = await database
            .collection("orders")
            .find({ status: { $ne: "cancelled" } })
            .sort({ createdAt: -1 })
            .toArray();
        }
      }

      // ZR Express CSV format
      const headers = [
        "nom complet",
        "telephone1",
        "telephone2",
        "produit",
        "quantite",
        "Sku",
        "type de stock",
        "Adresse",
        "Wilaya",
        "Commune",
        "prix total de la commande",
        "Note",
        "ID",
        "Stopdesk",
        "Nom stopDesk",
      ];

      const rows = orders.map((order) => {
        const productNames =
          order.products?.map((p) => p.title || p.name).join(", ") || "";
        const quantities =
          order.products?.map((p) => p.quantity).join(", ") || "";
        const firstProduct = order.products?.[0] || {};

        return [
          order.customerName || "",
          order.customerPhone || "",
          order.customerPhone2 || "",
          productNames,
          quantities,
          firstProduct.id || "",
          "",
          order.address || "",
          order.wilaya || "",
          order.commune || "",
          order.total?.toString() || "0",
          order.notes || "",
          order.id || "",
          "",
          "",
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ZR_Express_${Date.now()}.csv"`,
      );
      return res.send(csvContent);
    }

    // ==================== SETTINGS ====================

    if (pathname === "/api/settings" && method === "GET") {
      const database = await connectDB();
      if (database) {
        const settings = await database.collection("settings").findOne();
        return res.json(settings || {});
      }
      return res.json({});
    }

    if (pathname === "/api/settings" && method === "PUT") {
      const database = await connectDB();
      const settings = parseBody(req.body);

      if (database) {
        await database
          .collection("settings")
          .updateOne({}, { $set: settings }, { upsert: true });
      }

      return res.json({ success: true });
    }

    // ==================== ADMIN ====================

    if (pathname === "/api/admin/stats" && method === "GET") {
      const database = await connectDB();
      let products = [],
        orders = [];

      if (database) {
        products = await database.collection("products").find().toArray();
        orders = await database.collection("orders").find().toArray();
      }

      const revenue = orders.reduce(
        (sum, order) => sum + (order.total || 0),
        0,
      );

      return res.json({
        totalProducts: products.length,
        totalOrders: orders.length,
        totalRevenue: revenue,
        pendingOrders: orders.filter((o) => o.status === "pending").length,
      });
    }

    // DELETE /api/admin/cleanup - Keep last 100 orders, 24h window
    if (pathname === "/api/admin/cleanup" && method === "DELETE") {
      const database = await connectDB();

      if (database) {
        const now = new Date();
        const twentyFourHoursAgo = new Date(
          now.getTime() - 24 * 60 * 60 * 1000,
        );

        // Get orders to keep (last 100 recent or from last 24h)
        const ordersToKeep = await database
          .collection("orders")
          .find({})
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray();

        const keepIds = new Set(ordersToKeep.map((o) => o.id));

        // Delete old orders not in keep list and older than 24h
        const deleteResult = await database.collection("orders").deleteMany({
          $and: [
            { id: { $nin: Array.from(keepIds) } },
            { createdAt: { $lt: twentyFourHoursAgo.toISOString() } },
          ],
        });

        return res.json({
          success: true,
          deleted: deleteResult.deletedCount,
        });
      }

      return res.json({ success: true, deleted: 0 });
    }

    // ==================== UPLOADS ====================

    // POST /api/upload
    if (pathname === "/api/upload" && method === "POST") {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: "No image provided" });
      }

      // Handle multer uploaded file
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const result = await uploadToCloudinary(
        file.buffer,
        "windy-luxury/uploads",
      );
      return res.json(result);
    }

    // DELETE /api/upload/:publicId
    if (pathname.match(/^\/api\/upload\/.+$/) && method === "DELETE") {
      const publicId = pathname.split("/")[3];
      await deleteFromCloudinary(publicId);
      return res.json({ success: true });
    }

    // 404 - Not Found
    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};
