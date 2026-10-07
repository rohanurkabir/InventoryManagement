const express = require("express");
const router = express.Router();
const q = require("../db/queries");

router.get("/all", (req, res) => {
  // Return stock from every branch for owner reports.
  res.json(q.getAllInventory());
});

router.get("/", (req, res) => {
  // Return stock for one selected store.
  const { storeId } = req.query;
  if (!storeId) {
    return res.status(400).json({ error: "storeId query parameter is required." });
  }
  res.json(q.getInventoryForStore(storeId));
});

// +qty = receive / return,  -qty = damage / sale. Never go below 0.
router.post("/adjust", (req, res) => {
  // Record stock received, returned, damaged, or removed.
  const { sku, storeId, actingUsername, reason } = req.body;
  const change = parseInt(req.body.delta, 10);

  if (!sku || !storeId || Number.isNaN(change) || change === 0) {
    return res.status(400).json({ error: "sku, storeId and a non-zero quantity are required." });
  }

  const success = q.adjustInventoryQty(sku, storeId, change);
  if (!success) {
    return res.status(409).json({ error: "This would make stock negative — action blocked." });
  }

  const product = q.getProductBySku(sku);
  const store = q.getStoreById(storeId);
  const actionLabel = change > 0 ? "STOCK_IN" : "STOCK_OUT";

  q.addAuditLog(
    actingUsername || "system",
    actionLabel,
    `${change > 0 ? "+" : ""}${change} pc of ${product.name} (${sku}) ${reason || ""} at ${store.name}`.trim()
  );

  res.json({ success: true, newQty: q.getInventoryQty(sku, storeId) });
});

router.post("/transfer", (req, res) => {
  // Move stock from the warehouse to a branch.
  const { sku, fromStoreId, toStoreId, qty, actingUsername } = req.body;

  if (!sku || !fromStoreId || !toStoreId || !qty || qty <= 0) {
    return res.status(400).json({ error: "sku, fromStoreId, toStoreId and a positive qty are required." });
  }

  const result = q.transferStock(sku, fromStoreId, toStoreId, qty);
  if (!result.success) {
    return res.status(409).json({ error: "Not enough stock in the warehouse for this transfer." });
  }

  const product = q.getProductBySku(sku);
  const toStore = q.getStoreById(toStoreId);
  q.addAuditLog(
    actingUsername || "system",
    "TRANSFER",
    `Transferred ${qty} pcs of ${product.name} (${sku}) from Central Warehouse to ${toStore.name}`
  );

  res.json({ success: true });
});

module.exports = router;
