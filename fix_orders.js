// Fix orders.json file - run locally
const fs = require("fs");
const path = require("path");

const ORDERS_FILE = path.join(__dirname, "data", "orders.json");

// Reset orders file to empty array
fs.writeFileSync(ORDERS_FILE, "[]");
console.log("✅ orders.json has been reset to empty array");

// Also clean uploads folder
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (fs.existsSync(UPLOADS_DIR)) {
  const files = fs.readdirSync(UPLOADS_DIR);
  let deleted = 0;
  for (const file of files) {
    if (!file.startsWith(".")) {
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        fs.unlinkSync(filePath);
        deleted++;
      } catch (e) {}
    }
  }
  console.log("🧹 Cleaned up " + deleted + " files from uploads/");
}

console.log(
  "\n📝 Commit and push these changes to GitHub, then redeploy on Render.",
);
