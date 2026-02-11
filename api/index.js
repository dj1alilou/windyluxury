require("dotenv").config();
const express = require("express");
const cors = require("cors");
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

// MongoDB Connection
let cachedClient = null;
let cachedDb = null;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://windyadmin:hamoudihadil123@windy-cluster.dr4qj3p.mongodb.net/windyluxury?retryWrites=true&w=majority";

async function connectDB() {
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
    return { url: result.secure_url, publicId: result.public_id };
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

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/ping", (req, res) => res.send("OK"));
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// Categories
app.get("/api/categories", async (req, res) => {
  try {
    const database = await connectDB();
    if (database) {
      const categories = await database
        .collection("categories")
        .find()
        .toArray();
      res.json(categories.length > 0 ? categories : defaultCategories());
    } else {
      res.json(defaultCategories());
    }
  } catch (error) {
    res.json(defaultCategories());
  }
});

// Products
app.get("/api/products", async (req, res) => {
  try {
    const database = await connectDB();
    if (database) {
      const products = await database.collection("products").find().toArray();
      res.json(products);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products", upload.array("images", 4), async (req, res) => {
  try {
    const database = await connectDB();
    const productData = JSON.parse(req.body.product || "{}");
    const files = req.files;

    const images = [];
    for (const file of files) {
      const result = await uploadToCloudinary(
        file.buffer,
        "windy-luxury/products",
      );
      if (result) images.push(result);
    }

    const product = {
      id: Date.now().toString(),
      ...productData,
      images: images.length > 0 ? images : undefined,
      image: images.length > 0 ? images[0].url : productData.image,
      createdAt: new Date().toISOString(),
    };

    if (database) {
      await database.collection("products").insertOne(product);
    }

    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/products/:id", upload.array("images", 4), async (req, res) => {
  try {
    const database = await connectDB();
    const { id } = req.params;
    const productData = JSON.parse(req.body.product || "{}");
    const files = req.files;

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
      if (result) newImages.push(result);
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

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const database = await connectDB();
    const { id } = req.params;

    if (database) {
      const product = await database.collection("products").findOne({ id });
      if (product?.images) {
        for (const img of product.images) {
          if (img.publicId) await deleteFromCloudinary(img.publicId);
        }
      }
      await database.collection("products").deleteOne({ id });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Orders
app.get("/api/orders", async (req, res) => {
  try {
    const database = await connectDB();
    if (database) {
      const orders = await database
        .collection("orders")
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.json(orders);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const database = await connectDB();
    const order = {
      id: Date.now().toString(),
      ...req.body,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    if (database) {
      await database.collection("orders").insertOne(order);
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const database = await connectDB();
    const { id } = req.params;
    const { status } = req.body;

    if (database) {
      await database
        .collection("orders")
        .updateOne(
          { id },
          { $set: { status, updatedAt: new Date().toISOString() } },
        );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings
app.get("/api/settings", async (req, res) => {
  try {
    const database = await connectDB();
    if (database) {
      const settings = await database.collection("settings").findOne();
      res.json(settings || {});
    } else {
      res.json({});
    }
  } catch (error) {
    res.json({});
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const database = await connectDB();
    const settings = req.body;

    if (database) {
      await database
        .collection("settings")
        .updateOne({}, { $set: settings }, { upsert: true });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin stats
app.get("/api/admin/stats", async (req, res) => {
  try {
    const database = await connectDB();
    let products = [],
      orders = [];

    if (database) {
      products = await database.collection("products").find().toArray();
      orders = await database.collection("orders").find().toArray();
    }

    const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);

    res.json({
      totalProducts: products.length,
      totalOrders: orders.length,
      totalRevenue: revenue,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Image upload endpoint
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
    res.status(500).json({ error: error.message });
  }
});

// Export for Vercel
module.exports = app;
