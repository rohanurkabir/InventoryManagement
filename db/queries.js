// --- DATABASE QUERIES ---
// Route files call these functions instead of writing SQL in many places.
const db = require("./init");
const { makeId, DISCOUNT_MAX } = require("../helpers");

// --- USERS ---
function findUserByUsername(username) {
  // Find one account for login and password changes.
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

function getAllUsersSafe() {
  // Return user details without sending passwords to the browser.
  return db.prepare(
    "SELECT id, username, full_name AS fullName, role, store_id AS storeId FROM users"
  ).all();
}

function createUser({ id, username, password, fullName, role, storeId }) {
  db.prepare(
    "INSERT INTO users (id, username, password, full_name, role, store_id) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, username, password, fullName, role, storeId || null);
}

function deleteUserByUsername(username) {
  db.prepare("DELETE FROM users WHERE username = ?").run(username);
}

function updateUserPassword(username, newPassword) {
  db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
}

// --- STORES ---
function getAllStores() {
  // Load the branch list used throughout the app.
  return db.prepare("SELECT id, name, type, address FROM stores").all();
}

function getStoreById(storeId) {
  return db.prepare("SELECT id, name, type, address FROM stores WHERE id = ?").get(storeId);
}

// --- PRODUCTS ---
function getAllProducts() {
  // Load the product catalog.
  return db.prepare("SELECT sku, name, category, price FROM products").all();
}

function getProductBySku(sku) {
  return db.prepare("SELECT sku, name, category, price FROM products WHERE sku = ?").get(sku);
}

function updateProductPrice(sku, price) {
  db.prepare("UPDATE products SET price = ? WHERE sku = ?").run(price, sku);
}

// Product + first warehouse stock must both succeed, or neither is saved.
const createProductWithStock = db.transaction((product, storeId, initialQty) => {
  db.prepare("INSERT INTO products (sku, name, category, price) VALUES (?, ?, ?, ?)")
    .run(product.sku, product.name, product.category, product.price);

  db.prepare("INSERT INTO inventory (sku, store_id, quantity) VALUES (?, ?, ?)")
    .run(product.sku, storeId, initialQty);
});

// --- INVENTORY ---
function getInventoryForStore(storeId) {
  // Join stock with product details for one store.
  return db.prepare(`
    SELECT p.sku, p.name, p.category, p.price, i.quantity
    FROM inventory i
    JOIN products p ON p.sku = i.sku
    WHERE i.store_id = ?
    ORDER BY p.name
  `).all(storeId);
}

function getAllInventory() {
  return db.prepare(`
    SELECT i.sku, i.store_id AS storeId, i.quantity, p.name, s.name AS storeName
    FROM inventory i
    JOIN products p ON p.sku = i.sku
    JOIN stores s ON s.id = i.store_id
  `).all();
}

function getInventoryQty(sku, storeId) {
  const row = db.prepare("SELECT quantity FROM inventory WHERE sku = ? AND store_id = ?").get(sku, storeId);
  return row ? row.quantity : 0;
}

function adjustInventoryQty(sku, storeId, delta) {
  // Change stock while preventing the quantity from going below zero.
  const existing = db.prepare("SELECT quantity FROM inventory WHERE sku = ? AND store_id = ?").get(sku, storeId);
  const currentQty = existing ? existing.quantity : 0;
  const newQty = currentQty + delta;

  if (newQty < 0) return false;

  if (existing) {
    db.prepare("UPDATE inventory SET quantity = ? WHERE sku = ? AND store_id = ?").run(newQty, sku, storeId);
  } else {
    db.prepare("INSERT INTO inventory (sku, store_id, quantity) VALUES (?, ?, ?)").run(sku, storeId, newQty);
  }
  return true;
}

// Remove from warehouse and add to shop in one step.
function transferStock(sku, fromStoreId, toStoreId, qty) {
  const transfer = db.transaction(() => {
    const removed = adjustInventoryQty(sku, fromStoreId, -qty);
    if (!removed) {
      throw new Error("INSUFFICIENT_STOCK");
    }
    adjustInventoryQty(sku, toStoreId, qty);
  });

  try {
    transfer();
    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// --- SALES (POS CHECKOUT) ---
// One transaction: cut stock, save bill, apply discount. All succeed or none.
function processSale({ id, storeId, cashier, items, timestamp, paymentMethod, discountPercent }) {
  const processSaleTxn = db.transaction(() => {
    let subtotal = 0;
    const resolvedItems = [];

    for (const item of items) {
      const product = getProductBySku(item.sku);
      if (!product) throw new Error(`UNKNOWN_SKU:${item.sku}`);

      const removed = adjustInventoryQty(item.sku, storeId, -item.qty);
      if (!removed) throw new Error(`INSUFFICIENT_STOCK:${item.sku}`);

      subtotal += product.price * item.qty;
      resolvedItems.push({ sku: item.sku, name: product.name, qty: item.qty, price: product.price });
    }

    let percent = Number(discountPercent) || 0;
    if (percent < 0) percent = 0;
    if (percent > DISCOUNT_MAX) percent = DISCOUNT_MAX;
    const discount = Math.round(subtotal * percent / 100);
    const total = subtotal - discount;
    const method = paymentMethod || "Cash";

    db.prepare(
      "INSERT INTO sales (id, store_id, cashier, total, timestamp, payment_method, discount) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, storeId, cashier, total, timestamp, method, discount);

    const insertItem = db.prepare(
      "INSERT INTO sale_items (sale_id, sku, name, qty, price) VALUES (?, ?, ?, ?, ?)"
    );
    resolvedItems.forEach((i) => insertItem.run(id, i.sku, i.name, i.qty, i.price));

    return {
      id, storeId, cashier, subtotal, discount, total,
      paymentMethod: method, items: resolvedItems, timestamp
    };
  });

  return processSaleTxn();
}

function getSales(storeId) {
  // Load sales with their line items for reports and branch screens.
  const sales = storeId
    ? db.prepare("SELECT * FROM sales WHERE store_id = ? ORDER BY timestamp DESC").all(storeId)
    : db.prepare("SELECT * FROM sales ORDER BY timestamp DESC").all();

  const getItems = db.prepare("SELECT sku, name, qty, price FROM sale_items WHERE sale_id = ?");
  return sales.map((s) => ({
    id: s.id,
    storeId: s.store_id,
    cashier: s.cashier,
    total: s.total,
    timestamp: s.timestamp,
    paymentMethod: s.payment_method || "Cash",
    discount: s.discount || 0,
    items: getItems.all(s.id)
  }));
}

function getSalesSummaryByStore(from, to) {
  // Summarize revenue and bill count by branch.
  if (from && to) {
    return db.prepare(`
      SELECT s.id AS storeId, s.name AS storeName,
             COALESCE(SUM(sa.total), 0) AS revenue,
             COUNT(sa.id) AS transactions
      FROM stores s
      LEFT JOIN sales sa ON sa.store_id = s.id AND sa.timestamp >= ? AND sa.timestamp <= ?
      GROUP BY s.id
    `).all(from, to);
  }

  return db.prepare(`
    SELECT s.id AS storeId, s.name AS storeName,
           COALESCE(SUM(sa.total), 0) AS revenue,
           COUNT(sa.id) AS transactions
    FROM stores s
    LEFT JOIN sales sa ON sa.store_id = s.id
    GROUP BY s.id
  `).all();
}

function getTopProducts(limit) {
  // Rank products by the number of pieces sold.
  return db.prepare(`
    SELECT si.sku, si.name, SUM(si.qty) AS qtySold, SUM(si.qty * si.price) AS revenue
    FROM sale_items si
    GROUP BY si.sku, si.name
    ORDER BY qtySold DESC
    LIMIT ?
  `).all(limit || 5);
}

// --- AUDIT LOG ---
function addAuditLog(username, action, details) {
  // Keep a timestamped record of important actions.
  db.prepare(
    "INSERT INTO audit_logs (id, username, action, details, timestamp) VALUES (?, ?, ?, ?, ?)"
  ).run(makeId("LOG"), username, action, details, new Date().toISOString());
}

function getAuditLogs(searchTerm) {
  // Load activity history and apply an optional text search.
  let logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC").all();
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    logs = logs.filter((l) =>
      l.username.toLowerCase().includes(term) ||
      l.action.toLowerCase().includes(term) ||
      l.details.toLowerCase().includes(term)
    );
  }
  return logs;
}

module.exports = {
  findUserByUsername,
  getAllUsersSafe,
  createUser,
  deleteUserByUsername,
  updateUserPassword,
  getAllStores,
  getStoreById,
  getAllProducts,
  getProductBySku,
  updateProductPrice,
  createProductWithStock,
  getInventoryForStore,
  getAllInventory,
  getInventoryQty,
  adjustInventoryQty,
  transferStock,
  processSale,
  getSales,
  getSalesSummaryByStore,
  getTopProducts,
  addAuditLog,
  getAuditLogs
};
