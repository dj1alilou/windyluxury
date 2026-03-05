// Check what image URLs are in MongoDB
// Run: node check_mongodb_images.js

const { MongoClient } = require("mongodb");

const MONGODB_URI =
  "mongodb://windyluxury:hadil2026dj@ac-8loszcd-shard-00-00.98vdhye.mongodb.net:27017,ac-8loszcd-shard-00-01.98vdhye.mongodb.net:27017,ac-8loszcd-shard-00-02.98vdhye.mongodb.net:27017/windyluxury?ssl=true&authSource=admin&retryWrites=true";

async function checkMongoDB() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB\n");

    const db = client.db();
    const productsCollection = db.collection("products");

    // Get all products
    const products = await productsCollection.find({}).toArray();
    console.log(`📦 Found ${products.length} products in MongoDB\n`);

    // Collect all unique image URLs
    const allUrls = new Set();

    for (const product of products) {
      if (product.image) {
        allUrls.add(product.image);
      }
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach((img) => {
          if (img.url) {
            allUrls.add(img.url);
          }
        });
      }
    }

    console.log("🖼️ All unique image URLs in MongoDB:");
    console.log("=".repeat(80));

    allUrls.forEach((url) => {
      console.log(url);
    });

    console.log("=".repeat(80));
    console.log(`\nTotal unique URLs: ${allUrls.size}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.close();
  }
}

checkMongoDB();
