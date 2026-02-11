# Vercel Deployment Guide

This guide provides comprehensive instructions for deploying the Windy E-commerce application to Vercel's serverless platform.

## 1. Overview

This project is an e-commerce management application built with Node.js, Express (adapted for Vercel serverless functions), MongoDB for the database, and Cloudinary for image storage and management. The application provides RESTful API endpoints for managing products, categories, orders, and settings.

This guide covers everything from prerequisites to deployment and troubleshooting, ensuring a smooth transition to Vercel's platform.

## 2. Prerequisites

Before deploying to Vercel, ensure you have the following accounts and tools set up on your system. Each prerequisite is essential for the application to function correctly in a production environment.

### 2.1 Vercel Account

Create a Vercel account at [vercel.com](https://vercel.com) if you haven't already. You can sign up using your GitHub, GitLab, or Bitbucket account, which will streamline the deployment process. Vercel offers a generous free tier that includes serverless functions, custom domains, and SSL certificates.

### 2.2 Node.js Installation

Ensure Node.js version 18 or higher is installed on your system. You can download the latest version from [nodejs.org](https://nodejs.org) or use a version manager like nvm (Node Version Manager) for better control over your Node.js versions. To verify your Node.js version, run:

```bash
node --version
```

The output should display a version number starting with 18 or higher, such as `v18.19.0` or `v20.10.0`.

### 2.3 Vercel CLI Installation

Install the Vercel CLI globally using npm. This command installs the CLI globally on your system, allowing you to run vercel commands from any directory. If you encounter permission errors, you may need to run this command with administrative privileges.

```bash
npm i -g vercel
```

After installation, verify the CLI is working by checking its version:

```bash
vercel --version
```

### 2.4 MongoDB Atlas Account

Create a MongoDB Atlas account at [cloud.mongodb.com](https://cloud.mongodb.com) and set up a free cluster. MongoDB Atlas provides a fully managed MongoDB database with a generous free tier suitable for development and small production applications. You'll need to create a database user with appropriate permissions and configure network access to allow connections from Vercel's IP ranges.

### 2.5 Cloudinary Account

Create a Cloudinary account at [cloudinary.com](https://cloudinary.com) for image upload and management services. Cloudinary offers a free tier that includes storage, transformation, and delivery of images. After creating your account, navigate to your dashboard to retrieve your API credentials (cloud name, API key, and API secret).

## 3. Environment Variables Required

The application requires several environment variables to function correctly in production. These variables must be configured in the Vercel dashboard under your project's Settings > Environment Variables section.

### 3.1 MongoDB Connection String

The `MONGODB_URI` variable stores your MongoDB Atlas connection string. This string includes your database username, password, cluster address, and database name. The format follows this pattern:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

Replace `username` and `password` with your MongoDB Atlas database user credentials, `cluster` with your cluster name, and `database` with your database name. Ensure the database user has appropriate read and write permissions for your application.

### 3.2 Cloudinary Credentials

Cloudinary requires three environment variables for authentication and API access. These credentials are found in your Cloudinary dashboard under Account Details > API Credentials.

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

The cloud name is typically your account identifier, while the API key and secret are used for authentication when uploading or managing images through the Cloudinary API.

### 3.3 Setting Environment Variables in Vercel

To configure environment variables in Vercel, navigate to your project dashboard and follow these steps:

1. Click on **Settings** tab in your project overview
2. Select **Environment Variables** from the left sidebar
3. Add each variable with its corresponding value
4. Select the appropriate environment scope (Production, Preview, Development, or All)
5. Click **Save** to apply your changes

Environment variables marked for Production will be available during deployment and at runtime. Changes to environment variables require a redeployment to take effect.

## 4. Local Development Setup

Follow these steps to set up the project locally for development and testing before deploying to Vercel. This setup ensures your local environment mirrors the production environment as closely as possible.

### 4.1 Clone the Repository

First, clone the repository to your local machine using Git. If you haven't already cloned the repository, run the following command in your terminal, replacing `your-repository-url` with your actual Git repository URL.

```bash
git clone https://github.com/yourusername/your-repository.git
cd your-repository
```

If you already have the repository cloned, navigate to its directory and pull the latest changes to ensure you have the most recent code.

```bash
cd path/to/your-repository
git pull origin main
```

### 4.2 Install Dependencies

Install all required npm packages using the package manager. The project's `package.json` file contains all dependencies and scripts needed for development and production.

```bash
npm install
```

This command reads the `package.json` file and installs all listed dependencies in the `node_modules` directory. The installation process may take a few minutes depending on your internet connection and system performance.

### 4.3 Configure Local Environment

Create a `.env.local` file in the project root directory to store your local environment variables. This file is automatically ignored by Git through the `.gitignore` configuration, ensuring your sensitive credentials remain local.

```bash
touch .env.local
```

Add the following content to your `.env.local` file, replacing the placeholder values with your actual credentials:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4.4 Run Locally

You can run the application locally using either the development script or the Vercel CLI. Both methods provide live reloading and debugging capabilities during development.

**Option 1: Using npm run dev script**

```bash
npm run dev
```

This command starts the development server with hot reloading enabled. Any changes you make to the source files will automatically restart the server, providing a seamless development experience.

**Option 2: Using Vercel CLI**

```bash
npx vercel dev
```

The Vercel CLI simulates the Vercel environment locally, allowing you to test serverless functions and environment variables exactly as they would behave in production.

### 4.5 Access Local Development Server

Once the server is running, access your local development instance by opening your web browser and navigating to:

```
http://localhost:3000
```

The API endpoints will be available at `http://localhost:3000/api/` followed by the endpoint path. For example, the health check endpoint would be accessible at `http://localhost:3000/api/health`.

## 5. Deployment Steps

Deploying to Vercel involves connecting your GitHub repository to Vercel and configuring the necessary environment variables. Once configured, Vercel automatically deploys your application whenever you push changes to your repository.

### 5.1 Push Code to GitHub

Ensure your code is committed and pushed to a GitHub repository. Vercel integrates directly with GitHub, enabling automatic deployments on every push to your main branch.

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 5.2 Connect Repository to Vercel

To connect your GitHub repository to Vercel, follow these steps in the Vercel dashboard:

1. Log in to your Vercel account at [vercel.com](https://vercel.com)
2. Click **Add New...** > **Project** from the dashboard header
3. Select **Import Git Repository** from the dropdown menu
4. Choose your GitHub repository from the list
5. Vercel will detect your project settings automatically

### 5.3 Configure Environment Variables

After importing your repository, you'll see the Configure Project screen. Scroll down to the **Environment Variables** section and add each required variable:

| Variable Name         | Value                                | Environment                      |
| --------------------- | ------------------------------------ | -------------------------------- |
| MONGODB_URI           | Your MongoDB Atlas connection string | Production, Preview, Development |
| CLOUDINARY_CLOUD_NAME | Your Cloudinary cloud name           | Production, Preview, Development |
| CLOUDINARY_API_KEY    | Your Cloudinary API key              | Production, Preview, Development |
| CLOUDINARY_API_SECRET | Your Cloudinary API secret           | Production, Preview, Development |

### 5.4 Deploy

Click **Deploy** to start the deployment process. Vercel will:

1. Build your application using the configuration in `vercel.json`
2. Deploy serverless functions for your API endpoints
3. Configure CDN distribution for optimal performance
4. Generate a unique URL for your deployment

The deployment progress can be monitored in real-time in the Vercel dashboard. Upon successful deployment, you'll receive a production URL in the format `https://your-project-name.vercel.app`.

## 6. API Endpoints Reference

The application provides a comprehensive RESTful API for managing e-commerce data. All endpoints are prefixed with `/api/` when deployed to Vercel. The base URL for your production API will be `https://your-project-name.vercel.app/api/`.

### 6.1 Health Check Endpoints

These endpoints verify the API is running and accessible.

| Method | Endpoint      | Description                                                 |
| ------ | ------------- | ----------------------------------------------------------- |
| GET    | `/ping`       | Simple health check that returns a pong response            |
| GET    | `/api/health` | Detailed health check including database and service status |

The `/ping` endpoint is useful for load balancers and monitoring systems that need a quick health verification. The `/api/health` endpoint provides more detailed information about the application's status and dependencies.

### 6.2 Categories

| Method | Endpoint          | Description             |
| ------ | ----------------- | ----------------------- |
| GET    | `/api/categories` | Retrieve all categories |

This endpoint returns a list of all product categories in the database. The response includes category details such as name, description, and parent category if applicable.

### 6.3 Products

| Method | Endpoint            | Description                              |
| ------ | ------------------- | ---------------------------------------- |
| GET    | `/api/products`     | Get all products with optional filtering |
| POST   | `/api/products`     | Create a new product                     |
| PUT    | `/api/products/:id` | Update an existing product               |
| DELETE | `/api/products/:id` | Delete a product                         |

The products endpoints support various query parameters for filtering, sorting, and pagination. When creating or updating products, send a JSON body with the product details including name, price, description, category, and images.

**Example Create Product Request:**

```bash
curl -X POST https://your-project.vercel.app/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Widget",
    "price": 49.99,
    "category": "electronics",
    "description": "A high-quality widget",
    "images": ["image_public_id 1", "image_public_id 2"]
  }'
```

### 6.4 Orders

| Method | Endpoint                       | Description                                   |
| ------ | ------------------------------ | --------------------------------------------- |
| GET    | `/api/orders`                  | Get all orders with optional status filtering |
| POST   | `/api/orders`                  | Create a new order                            |
| PUT    | `/api/orders/:id/status`       | Update order status                           |
| GET    | `/api/orders/export/zrexpress` | Export orders to CSV format                   |

The orders endpoints manage customer orders including creation, status updates, and export functionality. The export endpoint generates a CSV file compatible with Zrexpress logistics integration.

**Example Update Order Status:**

```bash
curl -X PUT https://your-project.vercel.app/api/orders/order123/status \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped"}'
```

### 6.5 Settings

| Method | Endpoint        | Description                       |
| ------ | --------------- | --------------------------------- |
| GET    | `/api/settings` | Retrieve all application settings |
| PUT    | `/api/settings` | Update application settings       |

Settings include store configuration such as store name, currency, tax rates, shipping options, and other customizable parameters.

### 6.6 Admin Operations

| Method | Endpoint             | Description                                      |
| ------ | -------------------- | ------------------------------------------------ |
| GET    | `/api/admin/stats`   | Get administrative statistics and analytics      |
| DELETE | `/api/admin/cleanup` | Clean up old orders (configurable age threshold) |

The admin endpoints provide operational oversight and maintenance capabilities for the application administrator.

### 6.7 Image Upload and Management

| Method | Endpoint                | Description                     |
| ------ | ----------------------- | ------------------------------- |
| POST   | `/api/upload`           | Upload an image to Cloudinary   |
| DELETE | `/api/upload/:publicId` | Delete an image from Cloudinary |

The upload endpoint accepts multipart form data with an `image` field containing the file to upload. The response includes the Cloudinary public ID and secure URL for the uploaded image.

**Example Upload Request:**

```bash
curl -X POST https://your-project.vercel.app/api/upload \
  -F "image=@/path/to/image.jpg"
```

## 7. Troubleshooting

This section addresses common issues encountered during deployment and operation on Vercel's platform. Each issue includes symptoms, causes, and recommended solutions.

### 7.1 Cold Start Issues with MongoDB

**Symptom:** Initial API requests fail with timeout errors or connection refused messages, especially after periods of inactivity.

**Cause:** Vercel's serverless functions spin down after periods of inactivity. When a new request arrives, the function must cold start, which includes establishing a new MongoDB connection. MongoDB Atlas may temporarily reject connections during this process.

**Solution:** Implement connection pooling and retry logic in your API handlers. The application already includes connection caching, but ensure your MongoDB Atlas cluster allows connections from Vercel's IP ranges. Consider using MongoDB Atlas Serverless instances for better cold start handling, or implement a keep-alive mechanism using a scheduled ping.

```javascript
// Add retry logic to database connections
const connectWithRetry = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    console.error("MongoDB connection error, retrying...", err);
    setTimeout(connectWithRetry, 5000);
  }
};
```

### 7.2 Body Size Limits

**Symptom:** Large file uploads fail with 413 Payload Too Large errors.

**Cause:** Vercel serverless functions have a default maximum request body size of 4.5MB for AWS Lambda compatibility.

**Solution:** If you need to support larger uploads, consider the following approaches:

1. **Client-side compression:** Compress images before upload using libraries like browser-image-compression
2. **Chunked uploads:** Implement chunked upload functionality that sends data in smaller pieces
3. **Direct Cloudinary uploads:** Use Cloudinary's unsigned upload preset for direct browser-to-Cloudinary uploads, bypassing the Vercel function entirely

For Cloudinary direct uploads, implement an endpoint that returns an upload signature, then upload directly from the client:

```javascript
// Get upload signature for client-side upload
app.get("/api/upload/signature", async (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: "products" },
    process.env.CLOUDINARY_API_SECRET,
  );
  res.json({ timestamp, signature });
});
```

### 7.3 CORS Issues

**Symptom:** Browser requests to API endpoints are blocked with CORS policy errors, particularly when accessing from different domains.

**Cause:** Cross-Origin Resource Sharing (CORS) restrictions prevent browsers from making requests to different domains unless the server explicitly allows it.

**Solution:** The application includes CORS configuration. Ensure all allowed origins are properly configured, especially for production domains:

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:3000",
      "https://your-project.vercel.app",
      "https://your-custom-domain.com",
    ];
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
```

### 7.4 Environment Variables Not Set

**Symptom:** Application crashes on startup with undefined variable errors, or features fail silently.

**Cause:** Environment variables are not properly configured in the Vercel dashboard, or the application attempts to access variables that aren't defined.

**Solution:** Verify all required environment variables are set in Vercel:

1. Navigate to your project in Vercel dashboard
2. Go to **Settings** > **Environment Variables**
3. Confirm each variable is listed with the correct value
4. Ensure variables are assigned to the correct environment scope (Production, Preview, Development)
5. Redeploy the application after making changes

To debug environment variable issues locally, create a debug endpoint:

```javascript
app.get("/api/debug/env", (req, res) => {
  res.json({
    MONGODB_URI: process.env.MONGODB_URI ? "✓ Set" : "✗ Missing",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME
      ? "✓ Set"
      : "✗ Missing",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? "✓ Set" : "✗ Missing",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
      ? "✓ Set"
      : "✗ Missing",
  });
});
```

## 8. Switching from Express to Vercel

If you're migrating from a traditional Express server running on a VPS or dedicated hosting to Vercel's serverless platform, the following changes are required to ensure compatibility.

### 8.1 Understanding the Architecture Change

Traditional Express applications run continuously on a server, maintaining persistent connections and state. Vercel's serverless functions are stateless and short-lived, executing only during request handling. This fundamental difference requires adjustments to how connections are managed and how the application handles state.

The application has been adapted for Vercel serverless compatibility by implementing connection caching and proper cleanup handlers. The `vercel.json` configuration ensures API routes are handled correctly by the serverless functions.

### 8.2 API Base URL Configuration

When switching to Vercel, the API base URL changes from a dedicated server URL to the Vercel deployment URL. If your frontend application makes API calls, update the base URL configuration.

**For development (env.local):**

```env
NEXT_PUBLIC_API_BASE=http://localhost:3000
```

**For production (Vercel environment variables):**

```env
NEXT_PUBLIC_API_BASE=https://your-project.vercel.app
```

**In your frontend JavaScript code:**

```javascript
// Use relative paths in production, absolute in development
const API_BASE =
  window.API_BASE ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");

const response = await fetch(`${API_BASE}/api/products`);
```

### 8.3 Custom Deployments with API_BASE

For deployments where you need the API to be accessible from a different domain or subdomain, you can set the `API_BASE` environment variable to override the default behavior.

**Setting window.API_BASE for custom deployments:**

```javascript
// In your HTML or main JavaScript file
<script>
  // Set API base URL for custom deployments window.API_BASE =
  'https://api.yourdomain.com';
</script>
```

This approach is useful when you want to serve the frontend from one domain and the API from another (e.g., `yourdomain.com` for frontend, `api.yourdomain.com` for API), which requires configuring your DNS and SSL certificates appropriately.

### 8.4 Verifying the Migration

After switching to Vercel, verify your application is functioning correctly by testing each major feature:

1. **Health check:** Access `/api/health` to verify the API is responding
2. **Database operations:** Create, read, update, and delete records in each collection
3. **File uploads:** Upload an image and verify it appears in Cloudinary
4. **Order workflow:** Create an order and verify the complete lifecycle
5. **Export functionality:** Test the CSV export endpoint

### 8.5 Monitoring and Logs

Use the Vercel dashboard to monitor your deployed application. Access the **Functions** tab to view serverless function execution logs, duration, and memory usage. This information is crucial for identifying performance bottlenecks and debugging issues in production.

The Vercel CLI also provides real-time logging during development:

```bash
vercel logs --follow
```

This command streams live logs from your deployed application, helping you identify issues as they occur.

---

For additional support, refer to the [Vercel Documentation](https://vercel.com/docs) or open an issue in the project repository.
