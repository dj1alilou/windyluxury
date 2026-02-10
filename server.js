require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const cloudinary = require("cloudinary").v2;
const sharp = require("sharp");

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for temporary uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// MongoDB Connection
let db = null;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://windyadmin:hamoudihadil123@windy-cluster.dr4qj3p.mongodb.net/windyluxury?retryWrites=true&w=majority";

async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    db = client.db("windyluxury");
    console.log("✅ Connected to MongoDB Atlas");
    return true;
  } catch (err) {
    console.log("⚠️ MongoDB connection failed:", err.message);
    console.log("📁 Falling back to file-based storage");
    return false;
  }
}

// Image compression to WebP
async function compressToWebP(buffer) {
  try {
    const compressedBuffer = await sharp(buffer)
      .webp({ quality: 85 }) // High quality WebP (85% maintains quality while reducing size)
      .toBuffer();
    return compressedBuffer;
  } catch (error) {
    console.error("Error compressing image:", error);
    return buffer;
  }
}

// Upload to Cloudinary
async function uploadToCloudinary(buffer, folder = "windy-luxury") {
  try {
    // Compress to WebP first
    const webpBuffer = await compressToWebP(buffer);

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: "image",
          format: "webp",
        },
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
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
}

// Delete from Cloudinary
async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
}

// Default categories
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

// ============== API ROUTES ==============

// Health check
app.get("/ping", (req, res) => {
  res.send("OK");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Categories
app.get("/api/categories", async (req, res) => {
  try {
    if (db) {
      const categories = await db.collection("categories").find().toArray();
      res.json(categories.length > 0 ? categories : defaultCategories());
    } else {
      res.json(defaultCategories());
    }
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.json(defaultCategories());
  }
});

// Products
app.get("/api/products", async (req, res) => {
  try {
    if (db) {
      const products = await db.collection("products").find().toArray();
      res.json(products);
    } else {
      const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
      if (fs.existsSync(PRODUCTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
        res.json(data.products || []);
      } else {
        res.json([]);
      }
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products", upload.array("images", 4), async (req, res) => {
  try {
    const productData = JSON.parse(req.body.product || "{}");
    const files = req.files;

    // Upload images to Cloudinary
    const images = [];
    for (const file of files) {
      const result = await uploadToCloudinary(
        file.buffer,
        "windy-luxury/products",
      );
      images.push({
        url: result.url,
        publicId: result.publicId,
      });
    }

    const product = {
      id: Date.now().toString(),
      ...productData,
      images: images.length > 0 ? images : undefined,
      image: images.length > 0 ? images[0].url : productData.image,
      createdAt: new Date().toISOString(),
    };

    if (db) {
      await db.collection("products").insertOne(product);
    } else {
      // Fallback to file storage
      const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
      let data = { products: [], categories: [], settings: {} };
      if (fs.existsSync(PRODUCTS_FILE)) {
        data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
      }
      data.products.push(product);
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));
    }

    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/products/:id", upload.array("images", 4), async (req, res) => {
  try {
    const { id } = req.params;
    const productData = JSON.parse(req.body.product || "{}");
    const files = req.files;

    // Upload new images to Cloudinary
    const newImages = [];
    for (const file of files) {
      const result = await uploadToCloudinary(
        file.buffer,
        "windy-luxury/products",
      );
      newImages.push({
        url: result.url,
        publicId: result.publicId,
      });
    }

    // Get existing product
    let existingProduct = null;
    if (db) {
      existingProduct = await db.collection("products").findOne({ id });
    }

    // Merge images
    const existingImages = existingProduct?.images || [];
    const allImages = [...existingImages, ...newImages];

    const updatedProduct = {
      ...existingProduct,
      ...productData,
      images: allImages,
      image: allImages.length > 0 ? allImages[0].url : productData.image,
      updatedAt: new Date().toISOString(),
    };

    if (db) {
      await db
        .collection("products")
        .updateOne({ id }, { $set: updatedProduct });
    }

    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get product to delete images from Cloudinary
    let product = null;
    if (db) {
      product = await db.collection("products").findOne({ id });
      await db.collection("products").deleteOne({ id });
    }

    // Delete images from Cloudinary
    if (product?.images) {
      for (const img of product.images) {
        if (img.publicId) {
          await deleteFromCloudinary(img.publicId);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: error.message });
  }
});

// Orders
app.get("/api/orders", async (req, res) => {
  try {
    if (db) {
      const orders = await db
        .collection("orders")
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.json(orders);
    } else {
      const ORDERS_FILE = path.join(__dirname, "data", "orders.json");
      if (fs.existsSync(ORDERS_FILE)) {
        const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
        res.json(orders.reverse());
      } else {
        res.json([]);
      }
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    console.log(
      "Received order request:",
      JSON.stringify(req.body).substring(0, 200),
    );

    const order = {
      id: Date.now().toString(),
      ...req.body,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    if (db) {
      console.log("Saving to MongoDB...");
      await db.collection("orders").insertOne(order);
    } else {
      console.log("Saving to file...");
      const ORDERS_FILE = path.join(__dirname, "data", "orders.json");

      let orders = [];
      if (fs.existsSync(ORDERS_FILE)) {
        orders = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
      }
      orders.push(order);
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    }

    console.log("Order saved successfully:", order.id);
    res.status(201).json(order);
  } catch (error) {
    console.error("Error saving order:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (db) {
      await db
        .collection("orders")
        .updateOne(
          { id },
          { $set: { status, updatedAt: new Date().toISOString() } },
        );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Settings
app.get("/api/settings", async (req, res) => {
  try {
    if (db) {
      const settings = await db.collection("settings").findOne();
      res.json(settings || {});
    } else {
      const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
      if (fs.existsSync(PRODUCTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
        res.json(data.settings || {});
      } else {
        res.json({});
      }
    }
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.json({});
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const settings = req.body;

    if (db) {
      await db
        .collection("settings")
        .updateOne({}, { $set: settings }, { upsert: true });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Image upload endpoint (for direct uploads)
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const result = await uploadToCloudinary(
      req.file.buffer,
      "windy-luxury/uploads",
    );
    res.json(result);
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete image endpoint
app.delete("/api/upload/:publicId", async (req, res) => {
  try {
    const { publicId } = req.params;
    await deleteFromCloudinary(publicId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin stats
app.get("/api/admin/stats", async (req, res) => {
  try {
    let products = [],
      orders = [];

    if (db) {
      products = await db.collection("products").find().toArray();
      orders = await db.collection("orders").find().toArray();
    } else {
      const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
      const ORDERS_FILE = path.join(__dirname, "data", "orders.json");

      if (fs.existsSync(PRODUCTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
        products = data.products || [];
      }
      if (fs.existsSync(ORDERS_FILE)) {
        orders = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
      }
    }

    const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);

    res.json({
      totalProducts: products.length,
      totalOrders: orders.length,
      totalRevenue: revenue,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup old files from uploads directory
app.delete("/api/admin/cleanup", async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, "uploads");
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let deleted = 0;
      for (const file of files) {
        if (
          !file.startsWith(".") &&
          (file.endsWith(".jpg") ||
            file.endsWith(".jpeg") ||
            file.endsWith(".png"))
        ) {
          const filePath = path.join(uploadsDir, file);
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
      console.log("🧹 Cleaned up " + deleted + " files");
      res.json({ success: true, deleted });
    } else {
      res.json({ success: true, deleted: 0 });
    }
  } catch (error) {
    console.error("Error cleaning up:", error);
    res.status(500).json({ error: error.message });
  }
});

// Clean up old uploads on startup
function cleanupUploads() {
  const uploadsDir = path.join(__dirname, "uploads");
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    let deleted = 0;
    for (const file of files) {
      if (
        !file.startsWith(".") &&
        (file.endsWith(".jpg") ||
          file.endsWith(".jpeg") ||
          file.endsWith(".png"))
      ) {
        const filePath = path.join(uploadsDir, file);
        try {
          fs.unlinkSync(filePath);
          deleted++;
        } catch (e) {
          // Ignore errors
        }
      }
    }
    if (deleted > 0) {
      console.log("🧹 Cleaned up " + deleted + " old upload files");
    }
  }
}

// Initialize and start server
async function start() {
  cleanupUploads();
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

start();
