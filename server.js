app.post("/api/orders", async (req, res) => {
  try {
    console.log(
      "Received order request:",
      JSON.stringify(req.body).substring(0, 200),
    );

    const order = {
      id: Date.now().toString(),
      ...req.body,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    if (db) {
      console.log("Saving to MongoDB...");
      await db.collection("orders").insertOne(order);
    } else {
      console.log("Saving to file...");
      const ORDERS_FILE = path.join(__dirname, "data", "orders.json");

      // Ensure file exists
      let orders = [];
      try {
        if (fs.existsSync(ORDERS_FILE)) {
          const data = fs.readFileSync(ORDERS_FILE, "utf8");
          orders = JSON.parse(data);
        } else {
          console.log("Creating new orders file...");
          fs.writeFileSync(ORDERS_FILE, "[]");
        }
      } catch (e) {
        console.log("Error reading orders file:", e.message);
        // Try to create the file
        try {
          fs.writeFileSync(ORDERS_FILE, "[]");
        } catch (e2) {
          console.log("Cannot create orders file:", e2.message);
        }
        orders = [];
      }

      orders.push(order);
      try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
        console.log("Order saved to file:", order.id);
      } catch (e) {
        console.log("Error writing orders file:", e.message);
      }
    }

    console.log("Order saved successfully:", order.id);
    res.status(201).json(order);
  } catch (error) {
    console.error("Error saving order:", error);
    res.status(500).json({ error: error.message });
  }
});
