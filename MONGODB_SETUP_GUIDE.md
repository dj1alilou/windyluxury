# MongoDB Atlas Setup Guide

## Step 1: Create a MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free" or "Sign In" if you already have an account
3. Create a new account or login with Google/GitHub

## Step 2: Create a New Cluster

1. Once logged in, click **"Create"** button
2. Choose **"Free"** tier (M0 Sandbox)
3. For Cloud Provider: Choose **Google Cloud** (or AWS/Azure)
4. Select a Region (e.g., Frankfurt - closest to Europe)
5. Click **"Create Cluster"**
6. Wait for deployment (2-5 minutes)

## Step 3: Create a Database User

1. In the left menu, click **"Database Access"**
2. Click **"Add New Database User"**
3. Create a user with:
   - **Username:** `windyadmin`
   - **Password:** `hamoudihadil123` (or your choice)
   - **Role:** `Read and Write to any database`
4. Click "Add User"

## Step 4: Configure Network Access (IMPORTANT)

1. In the left menu, click **"Network Access"**
2. Click **"Add IP Address"**
3. Choose **"Allow Access from Anywhere"** (0.0.0.0/0)
   - This ensures your app can connect from any network
4. Click "Confirm"
5. Wait 1-2 minutes for the change to apply

## Step 5: Get Your Connection String

1. Click **"Database"** in the left menu
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Copy the connection string:
   ```
   mongodb+srv://windyadmin:<password>@cluster0.xxxxxx.mongodb.net/windyluxury?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password

## Step 6: Update Your .env File

Edit the `.env` file in your project:

```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://windyadmin:hamoudihadil123@your-cluster-name.xxxxxx.mongodb.net/windyluxury?retryWrites=true&w=majority
```

## Step 7: Restart Your Server

```bash
# Kill the current server (Ctrl+C in terminal)
# Then restart:
npm start
```

## Step 8: Verify Connection

You should see in the terminal:

```
✅ Connected to MongoDB Atlas
```

If you still see:

```
⚠️ MongoDB connection failed
📁 Falling back to file-based storage
```

- Wait 2-5 minutes for network changes to apply
- Try using a different network (mobile hotspot)
- Check that the cluster is not paused

## Troubleshooting

### "cluster0 is not found" or DNS errors

- Your network might be blocking MongoDB Atlas
- Try using a VPN or mobile hotspot

### "Authentication failed"

- Check username and password in connection string
- Make sure the database user has "Read and Write" permissions

### "IP not whitelisted"

- Go to Network Access and add 0.0.0.0/0 to allow all IPs

## Alternative: Use Local MongoDB

If MongoDB Atlas continues to fail, you can install MongoDB Community Server locally:

1. Download from: https://www.mongodb.com/try/download/community
2. Install and run the service
3. Update MONGODB_URI to: `mongodb://localhost:27017/windyluxury`
