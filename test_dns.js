const https = require("https");

// Try DNS-over-HTTPS lookup using Cloudflare
async function dnsOverHttpsLookup(hostname) {
  return new Promise((resolve, reject) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`;
    const options = {
      hostname: "cloudflare-dns.com",
      path: `/dns-query?name=${hostname}&type=A`,
      method: "GET",
      headers: { Accept: "application/dns-json" },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.Answer) {
            resolve(parsed.Answer.map((a) => a.data));
          } else {
            resolve([]);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function testMongoDBWithDoH() {
  console.log("Testing MongoDB with DNS-over-HTTPS...");

  const hostname = "ac-98vdhye-shard-00-00.98vdhye.mongodb.net";

  try {
    const ips = await dnsOverHttpsLookup(hostname);
    console.log(`Resolved IPs for ${hostname}:`, ips);
  } catch (err) {
    console.error("DNS-over-HTTPS lookup failed:", err.message);
  }
}

testMongoDBWithDoH();
