/**
 * Simple keep-alive script to ping Render backend /health every 10 minutes
 * usage: node scripts/keep-alive.mjs https://greencity-api.onrender.com
 */
import http from "node:http";
import https from "node:https";

const targetUrl = process.argv[2] || process.env.RENDER_BACKEND_URL;

if (!targetUrl) {
  console.error("Usage: node scripts/keep-alive.mjs <RENDER_BACKEND_URL>");
  console.error("Example: node scripts/keep-alive.mjs https://greencity-api.onrender.com");
  process.exit(1);
}

const healthEndpoint = `${targetUrl.replace(/\/$/, "")}/health`;

async function ping() {
  const client = healthEndpoint.startsWith("https") ? https : http;
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Pinging ${healthEndpoint}...`);

  client
    .get(healthEndpoint, (res) => {
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] Response Status: ${res.statusCode} (${duration}ms)`);
    })
    .on("error", (err) => {
      console.error(`[${new Date().toISOString()}] Ping error:`, err.message);
    });
}

// Initial ping
ping();

// Ping every 10 minutes (600,000 ms)
const TEN_MINUTES = 10 * 60 * 1000;
setInterval(ping, TEN_MINUTES);

console.log(`Keep-alive service started. Pinging ${healthEndpoint} every 10 minutes.`);
