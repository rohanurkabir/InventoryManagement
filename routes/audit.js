const express = require("express");
const router = express.Router();
const q = require("../db/queries");

// Owner: who did what (login, sale, transfer, add user, ...).
router.get("/", (req, res) => {
  // Search the activity history shown to the owner.
  const { search } = req.query;
  res.json(q.getAuditLogs(search || ""));
});

module.exports = router;
