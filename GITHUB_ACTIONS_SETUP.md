# GitHub Actions Setup - Step by Step

## Step 1: Push Changes to GitHub

```bash
git add .
git commit -m "Add GitHub Actions for keep-alive"
git push
```

## Step 2: Add GitHub Secrets

### Get Your Render URL:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your web service
3. Copy the URL (e.g., `https://your-app.onrender.com`)

### Add Secrets to GitHub:

1. Go to your GitHub Repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

| Secret Name  | Secret Value                                                    |
| ------------ | --------------------------------------------------------------- |
| `RENDER_URL` | Your Render app URL (e.g., `https://windy-luxury.onrender.com`) |

### Optional - Auto Deploy on Push:

1. In Render Dashboard → Your Web Service → **Settings**
2. Scroll to **Git Service Hooks**
3. Copy the **Deploy Hook URL**
4. Add another secret:

| Secret Name                 | Secret Value                |
| --------------------------- | --------------------------- |
| `RENDER_DEPLOY_WEBHOOK_URL` | Your Render deploy hook URL |

## Step 3: Configure Render Health Check (Optional)

1. In Render Dashboard → Your Web Service → **Settings**
2. Scroll to **Health Check**
3. Set:
   - **Health Check Path**: `/health`
   - **Grace Period**: `30` seconds
4. Save Changes

## Step 4: Verify It's Working

### Check GitHub Actions:

1. Go to your GitHub Repository
2. Click **Actions** tab
3. You should see:
   - "Keep Server Awake" workflow running every 14 minutes
   - "Deploy to Render" workflow available (runs on push to main)

### Test the Health Endpoint:

Visit: `https://your-app.onrender.com/health`

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-09T02:15:00.000Z",
  "uptime": 1234.56,
  "memory": { ... }
}
```

## How It Works

| Method                      | Frequency        | Purpose                                    |
| --------------------------- | ---------------- | ------------------------------------------ |
| GitHub Actions (`ping.yml`) | Every 14 minutes | External ping to keep server awake         |
| Render Health Check         | ~30 seconds      | Monitors server health, restarts if failed |
| Server Auto-ping            | Every 10 minutes | Internal self-ping (already in server.js)  |

## Troubleshooting

**GitHub Actions not running?**

- Make sure workflows are enabled in GitHub → Actions tab

**Server still sleeping?**

- Verify `RENDER_URL` secret is correct
- Check GitHub Actions logs for errors
- Ensure Render health check path is set to `/health`

**Need to manually trigger a ping?**

- Go to GitHub → Actions → "Keep Server Awake" → Run workflow
