const { MongoClient } = require("mongodb");

const DIRECT_URI =
  "mongodb://windyluxury:hadil2026dj@ac-8loszcd-shard-00-00.98vdhye.mongodb.net:27017,ac-8loszcd-shard-00-01.98vdhye.mongodb.net:27017,ac-8loszcd-shard-00-02.98vdhye.mongodb.net:27017/windyluxury?ssl=true&authSource=admin";

async function testDirectConnection() {
  console.log("Testing direct MongoDB connection...");
  console.log("URI:", DIRECT_URI);

  const client = new MongoClient(DIRECT_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });

  try {
    await client.connect();
    console.log("SUCCESS! Connected to MongoDB Atlas!");

    const db = client.db("windyluxury");
    await db.command({ ping: 1 });
    console.log("Ping successful!");

    // List collections
    const collections = await db.listCollections().toArray();
    console.log(
      "Collections:",
      collections.map((c) => c.name),
    );

    return true;
  } catch (err) {
    console.error("FAILED:", err.message);
    return false;
  } finally {
    await client.close();
  }
}

testDirectConnection();
