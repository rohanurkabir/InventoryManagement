const express = require("express");
const router = express.Router();
const q = require("../db/queries");
const { makeId } = require("../helpers");

// Owner dashboard cards: revenue per store for a date range.
router.get("/summary", (req, res) => {
  const { from, to } = req.query;
  res.json(q.getSalesSummaryByStore(from, to));
});

router.get("/top", (req, res) => {
  // Find the best-selling products for the owner dashboard.
  res.json(q.getTopProducts(5));
});

router.get("/", (req, res) => {
  // Load all sales or only sales from one branch.
  const { storeId } = req.query;
  res.json(q.getSales(storeId || null));
});

// POS checkout: save the bill and reduce shop stock.
router.post("/", (req, res) => {
  // Complete checkout, reduce stock, and save the sale together.
  const { storeId, cashier, items, paymentMethod, discountPercent } = req.body;

  if (!storeId || !cashier || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "storeId, cashier and a non-empty items array are required." });
  }

  try {
    const sale = q.processSale({
      id: makeId("SALE"),
      storeId,
      cashier,
      items,
      paymentMethod,
      discountPercent,
      timestamp: new Date().toISOString()
    });

    q.addAuditLog(
      cashier,
      "SALE",
      `Processed sale ${sale.id} worth ৳${sale.total.toLocaleString()} at ${q.getStoreById(storeId).name}`
    );

    res.status(201).json(sale);
  } catch (err) {
    if (err.message.startsWith("INSUFFICIENT_STOCK")) {
      const sku = err.message.split(":")[1];
      const product = q.getProductBySku(sku);
      return res.status(409).json({ error: `Not enough stock left for "${product ? product.name : sku}".` });
    }
    if (err.message.startsWith("UNKNOWN_SKU")) {
      return res.status(400).json({ error: "One of the items in the cart no longer exists." });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong while processing the sale." });
  }
});

module.exports = router;
