# Railway Deployment Guide

## Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub

## Step 2: Deploy Backend

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Choose your repo (windy-luxury)
4. Click **Configure**
5. Add Environment Variables:
   - `MONGODB_URI` = your MongoDB Atlas connection string
   - `CLOUDINARY_CLOUD_NAME` = ds63s4iv2
   - `CLOUDINARY_API_KEY` = 738127669539714
   - `CLOUDINARY_API_SECRET` = VQRbfFaLjaRmSpJTgLLin8aT_m4
   - `PORT` = 4000
6. Click **Deploy**

## Step 3: Get Backend URL

After deployment, Railway will give you a URL like:
`https://windy-luxury-production.up.railway.app`

## Step 4: Update Admin Config

Edit `admin.js` and change:

```javascript
const CONFIG = {
  API_BASE: "https://your-railway-url.up.railway.app/api",
};
```

## Step 5: Delete Render Service

Go to Render dashboard and delete your old service to free resources.

## Advantages of Railway:

- More generous free tier (500MB RAM, 1GB disk)
- Better Node.js support
- Automatic HTTPS
- Easy environment variable management
