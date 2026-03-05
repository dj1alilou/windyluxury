// Migrate images from one Cloudinary account to another
// Run: node migrate_cloudinary_to_cloudinary.js
//
// This script will:
// 1. Download all product images from OLD Cloudinary account
// 2. Upload them to NEW Cloudinary account
// 3. Save URL mapping for database update
//
// The site keeps working with old images during migration!

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
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

// Configure both Cloudinary instances
const oldCloudinary = require("cloudinary").v2;
oldCloudinary.config({
  cloud_name: OLD_CLOUD_NAME,
  api_key: OLD_API_KEY,
  api_secret: OLD_API_SECRET,
});

const newCloudinary = require("cloudinary").v2;
newCloudinary.config({
  cloud_name: NEW_CLOUD_NAME,
  api_key: NEW_API_KEY,
  api_secret: NEW_API_SECRET,
});

console.log("===========================================");
console.log("🚀 Cloudinary to Cloudinary Image Migration");
console.log("===========================================");
console.log(`📤 Source: ${OLD_CLOUD_NAME}`);
console.log(`📥 Destination: ${NEW_CLOUD_NAME}`);
console.log("===========================================\n");

// Get all unique image URLs from products
function getAllImageUrls() {
  const productsPath = path.join(__dirname, "data", "products.json");

  if (!fs.existsSync(productsPath)) {
    console.log("❌ products.json not found");
    return [];
  }

  const productsData = JSON.parse(fs.readFileSync(productsPath, "utf8"));
  const products = productsData.products || [];

  const imageUrls = new Set();

  products.forEach((product) => {
    // Add main image
    if (product.image) {
      imageUrls.add(product.image);
    }
    // Add images from images array
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img) => {
        if (img.url) {
          imageUrls.add(img.url);
        }
      });
    }
  });

  return Array.from(imageUrls);
}

// Download image from URL
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        // Handle redirects
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

// Upload to new Cloudinary
async function uploadToNewCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = newCloudinary.uploader.upload_stream(
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

// Extract public ID from Cloudinary URL
function getPublicIdFromUrl(url) {
  // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
  const match = url.match(/image\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  if (match) {
    return match[1]; // This includes the folder path like "windy-luxury/products/xxx"
  }
  return null;
}

// Main migration function
async function migrate() {
  const imageUrls = getAllImageUrls();

  console.log(`📦 Found ${imageUrls.length} unique image URLs in products\n`);

  if (imageUrls.length === 0) {
    console.log("❌ No images to migrate");
    return;
  }

  const mapping = {};
  let successCount = 0;
  let failCount = 0;

  // Create temp directory
  const tempDir = path.join(__dirname, "temp_migration");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  for (let i = 0; i < imageUrls.length; i++) {
    const oldUrl = imageUrls[i];
    const fileName = path.basename(oldUrl);
    process.stdout.write(
      `[${i + 1}/${imageUrls.length}] 📥 Downloading: ${fileName} ... `,
    );

    try {
      // Download from old Cloudinary
      const buffer = await downloadImage(oldUrl);
      console.log("✅ Downloaded, ");

      // Get public ID from old URL
      const oldPublicId = getPublicIdFromUrl(oldUrl);

      process.stdout.write(`     📤 Uploading to new Cloudinary... `);

      // Upload to new Cloudinary
      const result = await uploadToNewCloudinary(buffer, oldPublicId);

      // Save mapping
      mapping[oldUrl] = {
        newUrl: result.secure_url,
        newPublicId: result.public_id,
        oldPublicId: oldPublicId,
      };

      console.log("✅\n");
      console.log(`     New URL: ${result.secure_url}`);
      successCount++;
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
      mapping[oldUrl] = { error: error.message };
      failCount++;
    }
  }

  // Save mapping to file
  const mappingPath = path.join(
    __dirname,
    "data",
    "cloudinary_url_mapping.json",
  );
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

  // Clean up temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }

  console.log("\n===========================================");
  console.log("🎉 Migration Complete!");
  console.log("===========================================");
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📄 Mapping saved to: ${mappingPath}`);
  console.log("\n===========================================");
  console.log("NEXT STEPS:");
  console.log("===========================================");
  console.log("1. Review the mapping file to verify new URLs");
  console.log("2. Update your .env file with new Cloudinary credentials:");
  console.log(`   CLOUDINARY_CLOUD_NAME=${NEW_CLOUD_NAME}`);
  console.log(`   CLOUDINARY_API_KEY=${NEW_API_KEY}`);
  console.log(`   CLOUDINARY_API_SECRET=${NEW_API_SECRET}`);
  console.log("3. Update products.json or MongoDB with new image URLs");
  console.log("4. Test your site to make sure images load correctly");
  console.log("===========================================");
}

// Run migration
migrate().catch(console.error);
