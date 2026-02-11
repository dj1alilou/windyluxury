# Vercel Deployment Guide - windy.luxury

## Overview

Your application is now configured to run on Vercel with:

- **Frontend**: Static files (index.html, admin.html)
- **Backend**: Vercel Serverless Functions (api/index.js)
- **Images**: Cloudinary with WebP compression (85% quality)
- **Data**: MongoDB Atlas

## Step 1: Push Changes to GitHub

Open Terminal in your project folder and run:

```bash
cd c:/Users/Sc/Desktop/HTML/.vscode/windy
git add .
git commit -m "Migrate to Vercel - Cloudinary + MongoDB"
git push origin main
```

## Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Click **"Import Git Repository"**
4. Select your **windy** repository
5. Click **"Deploy"** (or configure settings first)

## Step 3: Add Environment Variables

In Vercel project settings, go to **Settings → Environment Variables** and add:

| Variable Name           | Value                                | Environment |
| ----------------------- | ------------------------------------ | ----------- |
| `MONGODB_URI`           | Your MongoDB Atlas connection string | Production  |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name           | Production  |
| `CLOUDINARY_API_KEY`    | Your Cloudinary API key              | Production  |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret           | Production  |

### Where to find these values:

**MongoDB URI:**

- Go to MongoDB Atlas → Your Cluster → "Connect" → "Connect your application"
- Copy the connection string
- Replace `<password>` with your database password

**Cloudinary Credentials:**

- Go to Cloudinary Dashboard
- Cloud Name is displayed at the top
- API Key and Secret are in Account Details

## Step 4: Redeploy with Environment Variables

After adding environment variables:

1. Go to **Deployments** tab in Vercel
2. Click the **three dots** on your deployment
3. Select **"Redeploy"**

## Step 5: Test Your Application

Visit your Vercel URL and test:

### Test 1: Frontend

- Go to `https://your-project.vercel.app/`
- Should load the main page with products

### Test 2: Admin Panel

- Go to `https://your-project.vercel.app/admin.html`
- Login with: admin / windy123

### Test 3: Image Upload

- In admin panel, add a new product
- Upload an image
- Verify image appears on frontend

### Test 4: Orders

- Place a test order on frontend
- Check in admin panel → Orders section

## Project Structure

```
windy/
├── api/
│   └── index.js          # Serverless backend (all API endpoints)
├── index.html             # Main storefront
├── admin.html             # Admin dashboard
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies
└── .env                   # Environment variables (local)
```

## API Endpoints

Your Vercel backend provides:

| Endpoint            | Method   | Description                |
| ------------------- | -------- | -------------------------- |
| `/api/products`     | GET      | Get all products           |
| `/api/products`     | POST     | Create product             |
| `/api/products/:id` | PUT      | Update product             |
| `/api/products/:id` | DELETE   | Delete product             |
| `/api/upload`       | POST     | Upload image to Cloudinary |
| `/api/orders`       | GET      | Get all orders             |
| `/api/orders`       | POST     | Create order               |
| `/api/orders/:id`   | PUT      | Update order status        |
| `/api/categories`   | GET      | Get categories             |
| `/api/settings`     | GET/POST | Get/update settings        |

## Troubleshooting

### Images not loading

- Check Cloudinary credentials in Vercel environment variables
- Verify products have Cloudinary URLs (not local paths)

### API errors (500)

- Check MongoDB URI is correct
- Ensure MongoDB Atlas IP whitelist includes Vercel's IPs (or 0.0.0.0/0)

### Upload fails

- Check Cloudinary upload preset allows unsigned uploads
- Or configure signed uploads in api/index.js

## Delete Railway Service (Optional)

To completely remove Railway:

1. Go to [railway.app](https://railway.app)
2. Select your windy service
3. Go to Settings → Danger Zone
4. Click "Delete Service"

## Current Configuration

- **API Base URL**: `/api` (relative, works on Vercel)
- **Image Quality**: WebP at 85%
- **MongoDB**: windyluxury database
- **Cloudinary Folder**: windy-luxury

## Need Help?

If something doesn't work:

1. Check browser console for errors (F12)
2. Check Vercel Function logs in Vercel Dashboard
3. Verify all environment variables are set correctly
