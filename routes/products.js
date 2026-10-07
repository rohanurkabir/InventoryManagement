const express = require("express");
const router = express.Router();
const q = require("../db/queries");

router.get("/", (req, res) => {
  // Show the product list used by warehouse and POS screens.
  res.json(q.getAllProducts());
});

// Warehouse: add a new saree and put starting stock in the warehouse.
router.post("/", (req, res) => {
  const { sku, name, category, price, initialQty, actingUsername } = req.body;
  const cleanSku = (sku || "").trim().toUpperCase();

  if (!cleanSku || !name || !category || price == null || price < 0 || initialQty == null || initialQty < 0) {
    return res.status(400).json({ error: "Please fill every field with valid values." });
  }

  if (q.getProductBySku(cleanSku)) {
    return res.status(409).json({ error: "A product with this SKU already exists." });
  }

  q.createProductWithStock(
    { sku: cleanSku, name, category, price: Number(price) },
    "ST_WAREHOUSE",
    Number(initialQty)
  );

  q.addAuditLog(
    actingUsername || "system",
    "ADD_PRODUCT",
    `Added new product ${name} (${cleanSku}) with ${initialQty} pcs`
  );

  res.status(201).json({ sku: cleanSku, name, category, price: Number(price) });
});

router.put("/:sku", (req, res) => {
  const sku = req.params.sku.toUpperCase();
  const { price, actingUsername } = req.body;

  if (price == null || Number(price) < 0) {
    return res.status(400).json({ error: "Please enter a valid price." });
  }

  const product = q.getProductBySku(sku);
  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }

  q.updateProductPrice(sku, Number(price));
  q.addAuditLog(
    actingUsername || "system",
    "UPDATE_PRICE",
    `Updated price of ${product.name} (${sku}) to ৳${Number(price).toLocaleString()}`
  );

  res.json({ sku, price: Number(price) });
});

module.exports = router;
