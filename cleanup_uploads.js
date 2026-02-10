// Cleanup script to remove local uploads after migration
// Run: node cleanup_uploads.js
// ⚠️  Only run after confirming migration was successful!

const fs = require("fs");
const path = require("path");

const UPLOADS_DIR = path.join(__dirname, "uploads");

function cleanup() {
  console.log("🧹 Starting cleanup of local uploads...\n");

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log("✅ No uploads directory found");
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  console.log("📁 Found " + files.length + " files in uploads directory\n");

  let deletedCount = 0;
  let keptCount = 0;

  // Files to keep (non-image files)
  const filesToKeep = [".gitkeep", ".gitignore", "index.html"];

  for (const file of files) {
    if (filesToKeep.includes(file)) {
      console.log("  ⏭️  Keeping: " + file);
      keptCount++;
      continue;
    }

    // Delete image files
    const filePath = path.join(UPLOADS_DIR, file);

    // Skip directories
    if (fs.statSync(filePath).isDirectory()) {
      console.log("  ⏭️  Skipping directory: " + file);
      continue;
    }

    try {
      fs.unlinkSync(filePath);
      console.log("  🗑️  Deleted: " + file);
      deletedCount++;
    } catch (error) {
      console.log("  ⚠️  Error deleting " + file + ": " + error.message);
    }
  }

  console.log("\n🎉 Cleanup complete!");
  console.log("   - Files deleted: " + deletedCount);
  console.log("   - Files kept: " + keptCount);
}

cleanup();
