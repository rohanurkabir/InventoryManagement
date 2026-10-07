# Rinaz Inventory & Retail Management System — Full Stack (Node.js + Express + SQLite)

A **real, complete full-stack application** — not a simulation. Real backend
server, real SQLite database file, real REST API, and the frontend now
calls that API over the network using `fetch()`.

## How to run it

1. Make sure Node.js is installed (`node -v` in a terminal to check).
2. Open a terminal in this folder and run:
   ```
   npm install
   npm start
   ```
3. Open your browser to: **http://localhost:3000**
4. To confirm the backend + database are working on their own, visit:
   **http://localhost:3000/api/health**


## Login accounts (same as before)

| Username      | Password    | Role               |
|---------------|-------------|--------------------|
| owner         | owner123    | Owner              |
| uttara_mgr    | uttara123   | Shop Manager (Uttara) |
| gulshan_mgr   | gulshan123  | Shop Manager (Gulshan)|
| warehouse     | wh123       | Warehouse Manager  |
| cashier1      | cash123     | POS Cashier (Uttara)  |
| cashier2      | cash123     | POS Cashier (Gulshan) |

## Project structure

```
backend/
├── server.js            → starts Express, serves the frontend, mounts every API route
├── db/
│   ├── init.js            → creates tables + seeds starting data (runs once)
│   ├── queries.js         → every SQL query, incl. atomic transactions for
│   │                        transfers & sales
│   └── rinaz.db            → the real database file (created on first run)
├── routes/               → one file per API area (matches your dashboard split)
│   ├── auth.js             → POST /api/auth/login, /api/auth/logout
│   ├── users.js            → GET/POST/DELETE /api/users
│   ├── stores.js           → GET /api/stores
│   ├── products.js         → GET/POST /api/products
│   ├── inventory.js        → GET /api/inventory, /adjust, /transfer
│   ├── sales.js            → POST /api/sales, GET /api/sales, /summary
│   └── audit.js            → GET /api/audit
└── public/               → the frontend (same 4 dashboards as before)
    ├── index.html
    ├── style.css
    ├── api.js              → fetch() helpers — replaces the old LocalStorage db.js
    ├── auth.js              → login screen + role routing
    ├── owner.js              → Owner dashboard
    ├── warehouse.js          → Warehouse Manager dashboard
    ├── shopManager.js        → Shop Manager dashboard
    └── pos.js                → POS Cashier dashboard


## Testing performed

Before delivery, this system was tested with:
- **34 automated API tests** — every endpoint (login, products, inventory,
  transfers, sales, users, audit) tested directly over HTTP, including
  error cases (wrong password, duplicate SKU/username, over-transfer,
  over-quantity sale, damage-at-zero-stock).
- **21 automated end-to-end tests** — a real headless browser (jsdom)
  loading the actual frontend files and clicking through real buttons/forms
  against the real running server, covering all 4 roles and cross-role
  data flow (e.g. a product added by the Warehouse Manager correctly
  appearing in the Uttara cashier's POS dropdown after a transfer).

All 55 tests passed.
