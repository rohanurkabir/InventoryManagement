// --- PROJECT INFO (easy to change for viva) ---
const APP_NAME = "Rinaz";
const APP_TAGLINE = "Rinaz Inventory Management System";
const UNIVERSITY_LINE = "IUBAT Practicum Project";
const STUDENT_NAME = "Rohanur Kabir";
const STUDENT_ID = "19303029";

// --- BUSINESS LIMITS ---
const LOW_STOCK_LIMIT = 2;     // warehouse warning
const SHOP_LOW_STOCK = 3;      // shop / POS warning
const DISCOUNT_MAX = 20;
const MIN_PASSWORD_LENGTH = 4;

const CURRENCY = "৳";

const ROLE_LABELS = {
  owner: "Owner",
  shop_manager: "Shop Manager",
  warehouse_manager: "Warehouse Manager",
  cashier: "POS Cashier"
};

const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Card"];

// Quick-fill buttons on the login page
const DEMO_ACCOUNTS = [
  { username: "owner", password: "owner123", label: "Owner" },
  { username: "uttara_mgr", password: "uttara123", label: "Uttara Manager" },
  { username: "gulshan_mgr", password: "gulshan123", label: "Gulshan Manager" },
  { username: "warehouse", password: "wh123", label: "Warehouse" },
  { username: "cashier1", password: "cash123", label: "Uttara Cashier" }
];
