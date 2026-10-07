const express = require("express");
const router = express.Router();
const q = require("../db/queries");

// Shop list used by login and dashboards (Uttara, Gulshan, Warehouse).
router.get("/", (req, res) => {
  // Load branches for login, filters, and dashboard labels.
  res.json(q.getAllStores());
});

module.exports = router;
