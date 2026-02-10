// Upload all local images to Cloudinary
// Run: node migrate_images.js

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const sharp = require("sharp");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log(
  "Cloudinary configured: " + process.env.CLOUDINARY_CLOUD_NAME + "\n",
);

async function compressToWebP(buffer) {
  try {
    const compressedBuffer = await sharp(buffer)
      .webp({ quality: 85 })
      .toBuffer();
    return compressedBuffer;
  } catch (error) {
    console.error("Error compressing image:", error);
    return buffer;
  }
}

async function uploadToCloudinary(filePath, folder = "windy-luxury/products") {
  try {
    const buffer = fs.readFileSync(filePath);
    const webpBuffer = await compressToWebP(buffer);

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
    console.error("Error uploading " + filePath + ":", error.message);
    return null;
  }
}

async function migrate() {
  console.log("🖼️ Starting image upload to Cloudinary...\n");

  const UPLOADS_DIR = path.join(__dirname, "uploads");

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log("❌ Uploads directory not found");
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  const imageFiles = files.filter(
    (f) =>
      !f.startsWith(".") &&
      (f.endsWith(".jpg") ||
        f.endsWith(".jpeg") ||
        f.endsWith(".png") ||
        f.endsWith(".gif")),
  );

  console.log("📁 Found " + imageFiles.length + " images in uploads/\n");

  let successCount = 0;
  const uploadedImages = {};

  for (const file of imageFiles) {
    const filePath = path.join(UPLOADS_DIR, file);
    process.stdout.write("  📤 Uploading: " + file + " ... ");

    const result = await uploadToCloudinary(filePath);

    if (result) {
      uploadedImages[file] = result;
      console.log("✅");
      console.log("     URL: " + result.url);
      successCount++;
    } else {
      console.log("❌");
    }
  }

  // Save uploaded images mapping to file
  const mappingPath = path.join(__dirname, "data", "cloudinary_images.json");
  fs.writeFileSync(mappingPath, JSON.stringify(uploadedImages, null, 2));

  console.log("\n🎉 Upload complete!");
  console.log(
    "   - Images uploaded: " + successCount + "/" + imageFiles.length,
  );
  console.log("   - Mapping saved to: " + mappingPath);
  console.log("\n✅ All local images are now in Cloudinary!");
  console.log(
    "\n🧹 Ready to clean up local uploads? Run: node cleanup_uploads.js",
  );
}

migrate();
