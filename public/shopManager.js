let shopStockCache = [];

async function renderShopManagerDashboard(container, user) {
  // Build the branch stock and sales screen.
  container.innerHTML = `
    ${welcomeBanner(user)}
    <h2 class="page-title">${getStoreNameById(user.storeId)} — Shop Manager</h2>
    <div id="shopStats" class="grid-3"></div>

    <div class="card">
      <div class="toolbar">
        <h2>Branch Stock</h2>
        <div class="toolbar-right">
          <label class="low-check"><input type="checkbox" id="shopLowOnly"> Low stock only</label>
          <input type="text" id="shopSearch" class="search-box" placeholder="Search SKU or name">
          <select id="shopCategoryFilter" class="filter-box">
            <option value="">All Categories</option>
          </select>
        </div>
      </div>
      <p class="msg">Return adds 1 piece. Damage removes 1 piece. Red rows have ${SHOP_LOW_STOCK} or fewer left.</p>
      <div class="scroll-table">
        <table>
          <thead>
            <tr><th>SKU</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
          </thead>
          <tbody id="shopStockTableBody"></tbody>
        </table>
      </div>
      <p id="shopStockMsg" class="msg"></p>
    </div>

    <div class="card">
      <h2>Recent Branch Sales</h2>
      <div class="scroll-table">
        <table>
          <thead>
            <tr><th>Time</th><th>Cashier</th><th>Payment</th><th>Items</th><th>Total</th></tr>
          </thead>
          <tbody id="shopSalesBody"></tbody>
        </table>
      </div>
    </div>
    ${passwordCardHtml()}
  `;

  await refreshShopScreen(user);
  bindPasswordForm(user);
  document.getElementById("shopSearch").addEventListener("input", applyShopFilters);
  document.getElementById("shopCategoryFilter").addEventListener("change", applyShopFilters);
  document.getElementById("shopLowOnly").addEventListener("change", applyShopFilters);
}

async function refreshShopScreen(user) {
  // Reload branch stock and recent sales together.
  const [stock, sales] = await Promise.all([
    apiGet(`/inventory?storeId=${user.storeId}`),
    apiGet(`/sales?storeId=${user.storeId}`)
  ]);
  shopStockCache = stock;
  renderShopStats(stock, sales);
  populateShopCategoryFilter();
  applyShopFilters();
  renderShopSales(sales);
}

function renderShopStats(stock, sales) {
  // Update the branch totals shown above the table.
  const totalUnits = stock.reduce((sum, p) => sum + p.quantity, 0);
  const lowCount = stock.filter((p) => isLowStock(p.quantity, SHOP_LOW_STOCK)).length;
  const revenue = sales.reduce((sum, s) => sum + s.total, 0);

  document.getElementById("shopStats").innerHTML = `
    <div class="stat stat-teal"><p>Pieces in shop</p><strong>${totalUnits}</strong></div>
    <div class="stat ${lowCount > 0 ? "stat-red" : "stat-green"}"><p>Low stock items</p><strong>${lowCount}</strong></div>
    <div class="stat stat-pink"><p>Branch sales</p><strong>${money(revenue)}</strong></div>
  `;
}

function populateShopCategoryFilter() {
  const select = document.getElementById("shopCategoryFilter");
  const categories = [...new Set(shopStockCache.map((p) => p.category))].sort();
  fillSelect(select, categories, "All Categories");
}

function applyShopFilters() {
  // Filter the cached branch stock without another API call.
  const search = document.getElementById("shopSearch").value;
  const category = document.getElementById("shopCategoryFilter").value;
  const lowOnly = document.getElementById("shopLowOnly").checked;
  const filtered = filterProducts(shopStockCache, search, category, lowOnly, SHOP_LOW_STOCK);
  renderShopStockTable(filtered);
}

function renderShopStockTable(stock) {
  // Draw stock rows and their return/damage actions.
  const tbody = document.getElementById("shopStockTableBody");
  if (stock.length === 0) {
    tbody.innerHTML = emptyRow(6, "No products match your search");
    return;
  }
  tbody.innerHTML = stock.map((p) => {
    const rowClass = isLowStock(p.quantity, SHOP_LOW_STOCK) ? "low-row" : "";
    const qtyClass = isLowStock(p.quantity, SHOP_LOW_STOCK) ? "low-qty" : "";
    const damageDisabled = p.quantity === 0 ? "disabled" : "";
    return `
      <tr class="${rowClass}">
        <td>${p.sku}</td>
        <td>${p.name}</td>
        <td>${categoryTag(p.category)}</td>
        <td>${money(p.price)}</td>
        <td class="${qtyClass}">${p.quantity}</td>
        <td>
          <button onclick="handleCustomerReturn('${p.sku}')" class="tiny-btn tiny-add">+ Return</button>
          <button onclick="handleDamagedStock('${p.sku}')" ${damageDisabled} class="tiny-btn tiny-remove">− Damage</button>
        </td>
      </tr>`;
  }).join("");
}

function renderShopSales(sales) {
  // Show the latest sales for this branch.
  const tbody = document.getElementById("shopSalesBody");
  const recent = sales.slice(0, 12);
  if (recent.length === 0) {
    tbody.innerHTML = emptyRow(5, "No sales yet");
    return;
  }
  tbody.innerHTML = recent.map((s) => {
    const itemText = s.items.map((i) => i.qty + " × " + i.name).join(", ");
    return `
      <tr>
        <td>${new Date(s.timestamp).toLocaleString()}</td>
        <td>${s.cashier}</td>
        <td><span class="tag tag-teal">${s.paymentMethod || "Cash"}</span></td>
        <td>${itemText}</td>
        <td>${money(s.total)}</td>
      </tr>`;
  }).join("");
}

async function handleCustomerReturn(sku) {
  // Add a returned item back to branch stock.
  const user = getSession();
  const msg = document.getElementById("shopStockMsg");
  try {
    await apiPost("/inventory/adjust", {
      sku, storeId: user.storeId, delta: 1, actingUsername: user.username, reason: "returned to stock"
    });
    showMessage(msg, "Return recorded: +1 added back to stock.", true);
    await refreshShopScreen(user);
  } catch (err) {
    showMessage(msg, err.message, false);
  }
}

async function handleDamagedStock(sku) {
  // Remove one damaged item from branch stock.
  const user = getSession();
  const msg = document.getElementById("shopStockMsg");
  try {
    await apiPost("/inventory/adjust", {
      sku, storeId: user.storeId, delta: -1, actingUsername: user.username, reason: "removed as damaged"
    });
    showMessage(msg, "Damage recorded: -1 removed from stock.", true);
    await refreshShopScreen(user);
  } catch (err) {
    showMessage(msg, err.message, false);
  }
}
