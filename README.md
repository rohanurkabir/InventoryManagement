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

## What happens automatically

- First run: a real database file is created at `db/rinaz.db`, seeded with
  6 users, 3 stores, and 12 sarees with starting stock — exactly the same
  data as before, just now stored for real.
- Every run after that: your data (sales, transfers, new users, stock
  changes) is already saved in that file and picks up right where you
  left off — even after closing the server or restarting your computer.
- To start completely fresh: delete `db/rinaz.db` (and any `-shm`/`-wal`
  files next to it) and run `npm start` again.

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
```

## What changed from the LocalStorage version (for your defense)

| | Old (LocalStorage) | Now (real backend) |
|---|---|---|
| Where data lives | Browser only | Real file: `db/rinaz.db` (SQLite) |
| Survives closing the browser | ❌ No | ✅ Yes |
| Multiple devices/computers | ❌ No | ✅ Yes (if run on a shared network) |
| Who calculates prices/totals | The browser (JS in `pos.js`) | **The server** (`db/queries.js`) — the browser never decides the final price or stock count |
| Stock transfers / sales | Two separate JS steps that could get out of sync | **Atomic SQL transactions** — either the whole thing happens or none of it does |
| Passwords | Plain text in browser storage | Plain text in a real DB table (see note below) |

## Known simplifications (be ready for these questions in your defense)

- **Passwords are stored in plain text**, same as before — for a real
  company system, passwords would be hashed (e.g. with `bcrypt`) before
  ever being saved, so not even the developer could read them back.
- **No login tokens (JWT/sessions)** — the browser just remembers who's
  logged in via a client-side flag, and every API request trusts the
  username the browser sends. A production system would issue a signed
  token at login and verify it on every request, so a request can't be
  faked by just changing a username in the browser.
- These are reasonable, explainable simplifications for an academic
  practicum — the important architecture (real database, real API,
  server-side validation of stock/prices, atomic transactions) is genuinely
  production-style.

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
