// Migrate ALL images from old Cloudinary to new Cloudinary
// Run: node migrate_all_cloudinary.js
//
// This will:
// 1. Get ALL images from MongoDB
// 2. Download each from old Cloudinary
// 3. Upload to new Cloudinary
// 4. Update MongoDB with new URLs
// 5. Update products.json with new URLs

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { MongoClient } = require("mongodb");
const cloudinary = require("cloudinary").v2;

// ============== CONFIGURATION ==============
// OLD Cloudinary account (current)
const OLD_CLOUD_NAME = "ds63s4iv2";
const OLD_API_KEY = "738127669539714";
const OLD_API_SECRET = "VQRbfFaLjaRmSpJTgLLin8aT_m4";

// NEW Cloudinary account (destination)
const NEW_CLOUD_NAME = "dw03lvk3g";
const NEW_API_KEY = "585762933898519";
const NEW_API_SECRET = "fYfeYL0oYH2jjYdD4lP_wLp2-1s";

// MongoDB connection
const MONGODB_URI =
  "mongodb://windyluxury:hadil2026dj@ac-8loszcd-shard-00-00.98vdhye.mongodb.net:27017,ac-8loszcd-shard-00-01.98vdhye.mongodb.net:27017,ac-8loszcd-shard-00-02.98vdhye.mongodb.net:27017/windyluxury?ssl=true&authSource=admin&retryWrites=true";

// Configure Cloudinary
cloudinary.config({
  cloud_name: NEW_CLOUD_NAME,
  api_key: NEW_API_KEY,
  api_secret: NEW_API_SECRET,
});

console.log("===========================================");
console.log("🚀 FULL Cloudinary Migration (MongoDB + Files)");
console.log("===========================================");
console.log(`📤 Source: ${OLD_CLOUD_NAME}`);
console.log(`📥 Destination: ${NEW_CLOUD_NAME}`);
console.log("===========================================\n");

// Get all image URLs from MongoDB
async function getAllImageUrlsFromMongoDB() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const productsCollection = db.collection("products");

    const products = await productsCollection.find({}).toArray();
    const allUrls = new Map(); // url -> productId

    for (const product of products) {
      if (product.image && product.image.includes(OLD_CLOUD_NAME)) {
        allUrls.set(product.image, product._id.toString());
      }
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach((img) => {
          if (img.url && img.url.includes(OLD_CLOUD_NAME)) {
            allUrls.set(img.url, product._id.toString());
          }
        });
      }
    }

    return { urls: Array.from(allUrls.keys()), client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}

// Download image from URL
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          downloadImage(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

// Extract public ID from Cloudinary URL
function getPublicIdFromUrl(url) {
  const match = url.match(/image\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  if (match) {
    const fullPath = match[1];
    if (fullPath.includes("/")) {
      return fullPath.split("/").pop();
    }
    return fullPath;
  }
  return null;
}

// Upload to new Cloudinary
async function uploadToNewCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: "windy-luxury/products",
        resource_type: "image",
        format: "webp",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    uploadStream.end(buffer);
  });
}

// Main migration function
async function migrate() {
  let mongoClient = null;

  try {
    // Step 1: Get all URLs from MongoDB
    console.log("📡 Fetching all image URLs from MongoDB...");
    const { urls, client, db } = await getAllImageUrlsFromMongoDB();
    mongoClient = client;

    console.log(`📦 Found ${urls.length} unique images to migrate\n`);

    if (urls.length === 0) {
      console.log("❌ No images to migrate");
      return;
    }

    const urlMapping = {};
    let successCount = 0;
    let failCount = 0;

    // Step 2: Migrate each image
    for (let i = 0; i < urls.length; i++) {
      const oldUrl = urls[i];
      const fileName = getPublicIdFromUrl(oldUrl) || path.basename(oldUrl);
      process.stdout.write(
        `[${i + 1}/${urls.length}] 📥 Downloading: ${fileName} ... `,
      );

      try {
        // Download from old Cloudinary
        const buffer = await downloadImage(oldUrl);
        console.log("✅ Downloaded, ");

        const oldPublicId = getPublicIdFromUrl(oldUrl);

        process.stdout.write(`     📤 Uploading to new Cloudinary... `);

        // Upload to new Cloudinary
        const result = await uploadToNewCloudinary(buffer, oldPublicId);

        // Save mapping
        urlMapping[oldUrl] = result.secure_url;

        console.log("✅\n");
        console.log(`     New URL: ${result.secure_url}`);
        successCount++;
      } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        failCount++;
      }
    }

    // Step 3: Update MongoDB with new URLs
    console.log("\n📝 Updating MongoDB with new image URLs...");
    const productsCollection = db.collection("products");
    const products = await productsCollection.find({}).toArray();

    let updateCount = 0;

    for (const product of products) {
      let needsUpdate = false;
      const updatedProduct = { ...product };

      // Update main image
      if (product.image && urlMapping[product.image]) {
        updatedProduct.image = urlMapping[product.image];
        needsUpdate = true;
      }

      // Update images array
      if (product.images && Array.isArray(product.images)) {
        updatedProduct.images = product.images.map((img) => {
          if (img.url && urlMapping[img.url]) {
            return { ...img, url: urlMapping[img.url] };
          }
          return img;
        });

        // Check if any image was updated
        if (
          JSON.stringify(product.images) !==
          JSON.stringify(updatedProduct.images)
        ) {
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await productsCollection.updateOne(
          { _id: product._id },
          { $set: updatedProduct },
        );
        updateCount++;
      }
    }

    console.log(`   ✅ Updated ${updateCount} products in MongoDB`);

    // Step 4: Save URL mapping to file
    const mappingPath = path.join(
      __dirname,
      "data",
      "cloudinary_url_mapping.json",
    );
    fs.writeFileSync(mappingPath, JSON.stringify(urlMapping, null, 2));

    console.log("\n===========================================");
    console.log("🎉 Migration Complete!");
    console.log("===========================================");
    console.log(`✅ Images migrated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📦 MongoDB products updated: ${updateCount}`);
    console.log(`📄 Mapping saved to: ${mappingPath}`);
    console.log("\n===========================================");
    console.log("✅ Your site now uses images from new Cloudinary!");
    console.log("===========================================");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("\n🔌 Disconnected from MongoDB");
    }
  }
}

// Run migration
migrate();
