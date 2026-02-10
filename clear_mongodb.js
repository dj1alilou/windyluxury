// Clear all MongoDB data
// Run: node clear_mongodb.js

require("dotenv").config();
const { MongoClient } = require("mongodb");

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://windyadmin:hamoudihadil123@windy-cluster.dr4qj3p.mongodb.net/windyluxury?retryWrites=true&w=majority";

async function clearDatabase() {
  console.log("🗑️  Clearing MongoDB database...\n");

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");

    const db = client.db("windyluxury");

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log("📦 Found " + collections.length + " collections\n");

    // Drop each collection
    for (const coll of collections) {
      try {
        await db.collection(coll.name).drop();
        console.log("  🗑️  Dropped: " + coll.name);
      } catch (err) {
        console.log("  ⚠️  Error dropping " + coll.name + ": " + err.message);
      }
    }

    console.log("\n🎉 MongoDB database cleared successfully!");
    console.log("\n📝 Note: Products and orders will use file-based storage");
    console.log("   until you redeploy with the new server code.");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.close();
  }
}

clearDatabase();
