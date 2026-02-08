// Ping script to keep the server alive
// Run this to ping your server every 10 minutes

const https = require("https");
const http = require("http");

// Configuration - Change this to your server URL
const SERVER_URL = process.env.SERVER_URL || "https://windy-luxury.vercel.app";

function pingServer() {
  const url = new URL("/ping", SERVER_URL);
  const protocol = url.protocol === "https:" ? https : http;

  console.log(`[${new Date().toISOString()}] Pinging ${url.href}...`);

  const req = protocol.get(url.href, (res) => {
    console.log(`[${new Date().toISOString()}] Status: ${res.statusCode}`);
    if (res.statusCode === 200) {
      console.log("✓ Ping successful");
    } else {
      console.log("✗ Ping failed with status:", res.statusCode);
    }
  });

  req.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] ✗ Ping error:`, error.message);
  });

  req.setTimeout(10000, () => {
    console.log("✗ Ping timed out");
    req.destroy();
  });
}

// Ping immediately on start
pingServer();

// Ping every 10 minutes (600000 milliseconds)
const INTERVAL = 10 * 60 * 1000; // 10 minutes
console.log(`Starting ping interval: every ${INTERVAL / 1000 / 60} minutes`);
setInterval(pingServer, INTERVAL);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nStopping ping script...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nStopping ping script...");
  process.exit(0);
});
