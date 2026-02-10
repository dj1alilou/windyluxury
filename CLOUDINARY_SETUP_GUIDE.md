# Cloudinary Setup Guide

## Step 1: Create Cloudinary Account

1. Go to [Cloudinary.com](https://cloudinary.com) and sign up for a free account
2. Verify your email and complete the setup

## Step 2: Get Your Credentials

1. After logging in, go to your Dashboard
2. Copy the following values:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

## Step 3: Update .env File

Add these values to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Step 4: Install Dependencies

```bash
npm install cloudinary sharp
```

## Step 5: Run Migration

After configuring Cloudinary, migrate your existing local images:

```bash
npm run migrate
```

## Step 6: Cleanup Local Files (Optional)

After successful migration, clean up local uploads:

```bash
npm run cleanup
```

## Image Features

- **Automatic WebP compression**: Images are compressed to WebP format with 85% quality
- **CDN delivery**: All images are delivered via Cloudinary's global CDN
- **Automatic optimization**: Cloudinary optimizes images for different devices

## Troubleshooting

### "Cannot read property 'upload_stream' of undefined"

Make sure Cloudinary is properly configured:

```javascript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

### "ENOENT: no such file or directory"

The migration script looks for images in the `uploads/` directory. Make sure:

1. The uploads directory exists
2. Images were previously uploaded via your application

### Upload fails with authentication error

Check your API credentials in the `.env` file. Make sure there are no typos and the values match exactly from your Cloudinary dashboard.
