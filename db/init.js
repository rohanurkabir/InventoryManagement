// --- DATABASE SETUP ---
// Opens rinaz.db and creates tables if this is the first run.
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "rinaz.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    type    TEXT NOT NULL,
    address TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id        TEXT PRIMARY KEY,
    username  TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role      TEXT NOT NULL,
    store_id  TEXT,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    sku      TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL,
    price    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inventory (
    sku      TEXT NOT NULL,
    store_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (sku, store_id),
    FOREIGN KEY (sku) REFERENCES products(sku),
    FOREIGN KEY (store_id) REFERENCES stores(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id        TEXT PRIMARY KEY,
    store_id  TEXT NOT NULL,
    cashier   TEXT NOT NULL,
    total     INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id  TEXT NOT NULL,
    sku      TEXT NOT NULL,
    name     TEXT NOT NULL,
    qty      INTEGER NOT NULL,
    price    INTEGER NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id        TEXT PRIMARY KEY,
    username  TEXT NOT NULL,
    action    TEXT NOT NULL,
    details   TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
`);

// Extra sale columns for older databases that were created before discount/payment.
function addColumnIfMissing(table, column, definition) {
  // Upgrade older databases without losing existing data.
  const cols = db.prepare("PRAGMA table_info(" + table + ")").all();
  const alreadyThere = cols.some((col) => col.name === column);
  if (!alreadyThere) {
    db.exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
  }
}

addColumnIfMissing("sales", "payment_method", "TEXT");
addColumnIfMissing("sales", "discount", "INTEGER DEFAULT 0");

// First-time sample data: stores, users, sarees, stock, and old sales.
function seedIfEmpty() {
  // Add realistic demo data the first time the app is opened.
  const storeCount = db.prepare("SELECT COUNT(*) AS n FROM stores").get().n;
  if (storeCount > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }

  console.log("Seeding database with initial data...");

  const insertStore = db.prepare("INSERT INTO stores (id, name, type, address) VALUES (?, ?, ?, ?)");
  const stores = [
    ["ST_UTTARA", "Uttara Branch", "shop", "Sector 7, Uttara, Dhaka"],
    ["ST_GULSHAN", "Gulshan Branch", "shop", "Pink City, Gulshan-2, Dhaka"],
    ["ST_WAREHOUSE", "Central Warehouse", "warehouse", "Tejgaon Industrial Area, Dhaka"]
  ];
  stores.forEach((s) => insertStore.run(...s));

  const insertUser = db.prepare(
    "INSERT INTO users (id, username, password, full_name, role, store_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const users = [
    ["U001", "owner", "owner123", "Nusrat Rahman", "owner", null],
    ["U002", "uttara_mgr", "uttara123", "Kamal Hossain", "shop_manager", "ST_UTTARA"],
    ["U003", "gulshan_mgr", "gulshan123", "Farhana Akter", "shop_manager", "ST_GULSHAN"],
    ["U004", "warehouse", "wh123", "Jashim Uddin", "warehouse_manager", "ST_WAREHOUSE"],
    ["U005", "cashier1", "cash123", "Sadia Islam", "cashier", "ST_UTTARA"],
    ["U006", "cashier2", "cash123", "Tanvir Ahmed", "cashier", "ST_GULSHAN"]
  ];
  users.forEach((u) => insertUser.run(...u));

  const insertProduct = db.prepare("INSERT INTO products (sku, name, category, price) VALUES (?, ?, ?, ?)");

  const products = [
    { sku: "RNZ-JAM-001", name: "Handloom Jamdani Saree",         category: "Jamdani",    price: 8500,  wh: 24, utt: 9,  guls: 7  },
    { sku: "RNZ-MUS-002", name: "Sopura Muslin Saree",            category: "Muslin",     price: 6200,  wh: 30, utt: 11, guls: 10 },
    { sku: "RNZ-KAT-003", name: "Katan Silk Saree",               category: "Silk",       price: 12500, wh: 18, utt: 5,  guls: 0  },
    { sku: "RNZ-BRD-004", name: "Bridal Katan Benarasi Saree",    category: "Bridal",     price: 25000, wh: 10, utt: 2,  guls: 4  },
    { sku: "RNZ-TAN-005", name: "Tangail Tant Saree",             category: "Tant",       price: 3200,  wh: 40, utt: 14, guls: 12 },
    { sku: "RNZ-MUS-006", name: "Dhakai Muslin Saree",            category: "Muslin",     price: 7800,  wh: 22, utt: 8,  guls: 9  },
    { sku: "RNZ-JAM-007", name: "Half-Silk Jamdani Saree",        category: "Jamdani",    price: 9500,  wh: 20, utt: 7,  guls: 6  },
    { sku: "RNZ-GEO-008", name: "Georgette Party Saree",          category: "Party Wear", price: 4500,  wh: 28, utt: 10, guls: 13 },
    { sku: "RNZ-BRD-009", name: "Bridal Rajshahi Silk Saree",     category: "Bridal",     price: 18500, wh: 12, utt: 6,  guls: 1  },
    { sku: "RNZ-CTN-010", name: "Handloom Cotton Saree",          category: "Cotton",     price: 1800,  wh: 45, utt: 16, guls: 15 },
    { sku: "RNZ-SLK-011", name: "Rajshahi Silk Saree",            category: "Silk",       price: 9800,  wh: 19, utt: 7,  guls: 8  },
    { sku: "RNZ-PRT-012", name: "Printed Casual Saree",           category: "Casual",     price: 2200,  wh: 35, utt: 12, guls: 14 },
    { sku: "RNZ-BRD-013", name: "Bridal Kanjivaram Silk Saree",   category: "Bridal",     price: 32000, wh: 8,  utt: 3,  guls: 2  },
    { sku: "RNZ-JAM-014", name: "Dhakai Jamdani Premium",         category: "Jamdani",    price: 15000, wh: 14, utt: 5,  guls: 4  },
    { sku: "RNZ-MUS-015", name: "Muslin Cotton Blend Saree",      category: "Muslin",     price: 4800,  wh: 26, utt: 9,  guls: 11 },
    { sku: "RNZ-KAT-016", name: "Pure Katan Banarasi Saree",      category: "Silk",       price: 21000, wh: 11, utt: 4,  guls: 3  },
    { sku: "RNZ-TAN-017", name: "Tangail Cotton Saree",           category: "Tant",       price: 2600,  wh: 32, utt: 13, guls: 10 },
    { sku: "RNZ-GEO-018", name: "Georgette Embroidered Saree",    category: "Party Wear", price: 5800,  wh: 21, utt: 8,  guls: 9  },
    { sku: "RNZ-CTN-019", name: "Khadi Cotton Saree",             category: "Cotton",     price: 2100,  wh: 38, utt: 14, guls: 12 },
    { sku: "RNZ-SLK-020", name: "South Silk Saree",               category: "Silk",       price: 11500, wh: 16, utt: 6,  guls: 5  },
    { sku: "RNZ-PRT-021", name: "Digital Print Georgette Saree",  category: "Casual",     price: 2800,  wh: 29, utt: 11, guls: 10 },
    { sku: "RNZ-BRD-022", name: "Bridal Zari Work Saree",         category: "Bridal",     price: 28000, wh: 9,  utt: 3,  guls: 2  },
    { sku: "RNZ-CHF-023", name: "Chiffon Party Saree",            category: "Party Wear", price: 3800,  wh: 24, utt: 9,  guls: 8  },
    { sku: "RNZ-LIN-024", name: "Linen Saree",                    category: "Casual",     price: 3200,  wh: 31, utt: 12, guls: 11 }
  ];
  products.forEach((p) => insertProduct.run(p.sku, p.name, p.category, p.price));

  const insertInventory = db.prepare(
    "INSERT INTO inventory (sku, store_id, quantity) VALUES (?, ?, ?)"
  );
  products.forEach((p) => {
    insertInventory.run(p.sku, "ST_WAREHOUSE", p.wh);
    insertInventory.run(p.sku, "ST_UTTARA", p.utt);
    insertInventory.run(p.sku, "ST_GULSHAN", p.guls);
  });

  const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
  const findPrice = (sku) => products.find((p) => p.sku === sku).price;
  const findName = (sku) => products.find((p) => p.sku === sku).name;

  const salesHistory = [
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(28), items: [{ sku: "RNZ-CTN-010", qty: 2 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(26), items: [{ sku: "RNZ-MUS-002", qty: 1 }, { sku: "RNZ-PRT-012", qty: 1 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(24), items: [{ sku: "RNZ-JAM-001", qty: 1 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(21), items: [{ sku: "RNZ-TAN-005", qty: 2 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(19), items: [{ sku: "RNZ-GEO-008", qty: 1 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(17), items: [{ sku: "RNZ-SLK-011", qty: 1 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(15), items: [{ sku: "RNZ-CTN-019", qty: 3 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(13), items: [{ sku: "RNZ-MUS-015", qty: 2 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(11), items: [{ sku: "RNZ-JAM-007", qty: 1 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(9),  items: [{ sku: "RNZ-PRT-021", qty: 2 }, { sku: "RNZ-CHF-023", qty: 1 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(7),  items: [{ sku: "RNZ-TAN-017", qty: 2 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(5),  items: [{ sku: "RNZ-BRD-013", qty: 1 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(3),  items: [{ sku: "RNZ-KAT-016", qty: 1 }] },
    { storeId: "ST_UTTARA", cashier: "cashier1", when: daysAgo(1),  items: [{ sku: "RNZ-LIN-024", qty: 2 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(27), items: [{ sku: "RNZ-GEO-008", qty: 2 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(25), items: [{ sku: "RNZ-CTN-010", qty: 3 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(23), items: [{ sku: "RNZ-MUS-006", qty: 1 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(20), items: [{ sku: "RNZ-TAN-005", qty: 1 }, { sku: "RNZ-PRT-012", qty: 2 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(18), items: [{ sku: "RNZ-SLK-020", qty: 1 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(16), items: [{ sku: "RNZ-JAM-014", qty: 1 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(14), items: [{ sku: "RNZ-CHF-023", qty: 2 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(12), items: [{ sku: "RNZ-CTN-019", qty: 2 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(10), items: [{ sku: "RNZ-GEO-018", qty: 1 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(8),  items: [{ sku: "RNZ-BRD-022", qty: 1 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(6),  items: [{ sku: "RNZ-MUS-015", qty: 3 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(4),  items: [{ sku: "RNZ-TAN-017", qty: 1 }] },
    { storeId: "ST_GULSHAN", cashier: "cashier2", when: daysAgo(2),  items: [{ sku: "RNZ-LIN-024", qty: 1 }] }
  ];

  const insertSale = db.prepare("INSERT INTO sales (id, store_id, cashier, total, timestamp) VALUES (?, ?, ?, ?, ?)");
  const insertSaleItem = db.prepare("INSERT INTO sale_items (sale_id, sku, name, qty, price) VALUES (?, ?, ?, ?, ?)");
  const deductStock = db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE sku = ? AND store_id = ?");
  const insertAuditLog = db.prepare(
    "INSERT INTO audit_logs (id, username, action, details, timestamp) VALUES (?, ?, ?, ?, ?)"
  );

  salesHistory.forEach((sale, index) => {
    const saleId = "SALE-SEED-" + index;
    const total = sale.items.reduce((sum, i) => sum + findPrice(i.sku) * i.qty, 0);

    insertSale.run(saleId, sale.storeId, sale.cashier, total, sale.when);
    sale.items.forEach((i) => {
      insertSaleItem.run(saleId, i.sku, findName(i.sku), i.qty, findPrice(i.sku));
      deductStock.run(i.qty, i.sku, sale.storeId);
    });

    const storeName = sale.storeId === "ST_UTTARA" ? "Uttara Branch" : "Gulshan Branch";
    insertAuditLog.run(
      "LOG-SEED-" + index,
      sale.cashier,
      "SALE",
      `Processed sale ${saleId} worth ৳${total.toLocaleString()} at ${storeName}`,
      sale.when
    );
  });

  console.log("Seeding complete.");
}

seedIfEmpty();

module.exports = db;

