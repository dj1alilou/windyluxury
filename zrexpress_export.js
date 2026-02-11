// ZR Express CSV Export - Add this to server.js after the orders section

app.get("/api/orders/export/zrexpress", async (req, res) => {
  try {
    let orders = [];

    if (db) {
      orders = await db
        .collection("orders")
        .find({ status: { $ne: "cancelled" } })
        .sort({ createdAt: -1 })
        .toArray();
    } else {
      const ORDERS_FILE = path.join(__dirname, "data", "orders.json");
      if (fs.existsSync(ORDERS_FILE)) {
        orders = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
      }
    }

    // ZR Express CSV format
    const headers = [
      "nom complet",
      "telephone1",
      "telephone2",
      "produit",
      "quantite",
      "Sku",
      "type de stock",
      "Adresse",
      "Wilaya",
      "Commune",
      "prix total de la commande",
      "Note",
      "ID",
      "Stopdesk",
      "Nom stopDesk",
    ];

    const rows = orders.map((order) => {
      // Get first product info
      const firstProduct = order.products?.[0] || {};
      const productNames = order.products?.map((p) => p.title).join(", ") || "";
      const quantities =
        order.products?.map((p) => p.quantity).join(", ") || "";

      return [
        order.customerName || "",
        order.customerPhone || "",
        order.customerPhone2 || "",
        productNames,
        quantities,
        firstProduct.id || "",
        "",
        order.address || "",
        order.wilaya || "",
        order.commune || "",
        order.total?.toString() || "0",
        order.notes || "",
        order.id || "",
        "",
        "",
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Set headers for CSV download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ZR_Express_${Date.now()}.csv"`,
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting orders:", error);
    res.status(500).json({ error: error.message });
  }
});
