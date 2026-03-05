// Update MongoDB products with new Cloudinary image URLs
// Run: node update_mongodb_images.js

const { MongoClient } = require("mongodb");

// Direct MongoDB connection (works when SRV is blocked)
const MONGODB_URI =
  "mongodb://windyluxury:hadil2026dj@ac-8loszcd-shard-00-00.98vdhye.mongodb.net:27017,ac-8loszcd-shard-00-01.98vdhye.mongodb.net:27017,ac-8loszcd-shard-00-02.98vdhye.mongodb.net:27017/windyluxury?ssl=true&authSource=admin&retryWrites=true";

// URL mapping from migration
const urlMapping = {
  "https://res.cloudinary.com/ds63s4iv2/image/upload/v1770833263/windy-luxury/products/rvim87pfblwnlh8ueoae.webp":
    "https://res.cloudinary.com/dw03lvk3g/image/upload/v1772591636/windy-luxury/products/rvim87pfblwnlh8ueoae.webp",
};

async function updateMongoDB() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db();
    const productsCollection = db.collection("products");

    // Get all products
    const products = await productsCollection.find({}).toArray();
    console.log(`📦 Found ${products.length} products in MongoDB`);

    let updateCount = 0;

    for (const product of products) {
      let needsUpdate = false;
      const updatedProduct = { ...product };

      // Update main image
      if (product.image && urlMapping[product.image]) {
        updatedProduct.image = urlMapping[product.image];
        needsUpdate = true;
        console.log(
          `📝 Updating main image for product: ${product.name || product.id}`,
        );
      }

      // Update images array
      if (product.images && Array.isArray(product.images)) {
        updatedProduct.images = product.images.map((img) => {
          if (img.url && urlMapping[img.url]) {
            needsUpdate = true;
            return { ...img, url: urlMapping[img.url] };
          }
          return img;
        });
      }

      if (needsUpdate) {
        await productsCollection.updateOne(
          { _id: product._id },
          { $set: updatedProduct },
        );
        updateCount++;
        console.log(`   ✅ Updated product: ${product.name || product.id}`);
      }
    }

    console.log(`\n🎉 MongoDB update complete!`);
    console.log(`   Products updated: ${updateCount}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

updateMongoDB();
