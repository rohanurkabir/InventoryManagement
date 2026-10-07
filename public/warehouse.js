let warehouseStockCache = [];

async function renderWarehouseDashboard(container, user) {
  // Build the warehouse stock, receiving, transfer, and pricing screen.
  container.innerHTML = `
    ${welcomeBanner(user)}
    <h2 class="page-title">Warehouse Dashboard</h2>
    <div id="warehouseStats" class="grid-3"></div>
    <div id="lowStockBanner"></div>

    <div class="card">
      <div class="toolbar">
        <h2>Central Warehouse Stock</h2>
        <div class="toolbar-right">
          <label class="low-check"><input type="checkbox" id="warehouseLowOnly"> Low stock only</label>
          <input type="text" id="warehouseSearch" class="search-box" placeholder="Search SKU or name">
          <select id="warehouseCategoryFilter" class="filter-box">
            <option value="">All Categories</option>
          </select>
        </div>
      </div>
      <div class="scroll-table">
        <table>
          <thead>
            <tr><th>SKU</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th></tr>
          </thead>
          <tbody id="warehouseStockTableBody"></tbody>
        </table>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>Add New Product</h2>
        <form id="addProductForm">
          <div class="field">
            <label>SKU</label>
            <input type="text" id="newSku" required placeholder="RNZ-SLK-025">
          </div>
          <div class="field">
            <label>Product Name</label>
            <input type="text" id="newName" required placeholder="Silk Half Saree">
          </div>
          <div class="field">
            <label>Category</label>
            <input type="text" id="newCategory" required placeholder="Silk">
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Price (BDT)</label>
              <input type="number" id="newPrice" required min="0">
            </div>
            <div class="field">
              <label>Initial Qty</label>
              <input type="number" id="newQty" required min="0">
            </div>
          </div>
          <p id="addProductMsg" class="msg"></p>
          <button type="submit" class="btn btn-main">Add Product</button>
        </form>
      </div>

      <div class="card">
        <h2>Receive Stock</h2>
        <form id="receiveForm">
          <div class="field">
            <label>Product</label>
            <select id="receiveSku" required></select>
          </div>
          <div class="field">
            <label>Quantity Received</label>
            <input type="number" id="receiveQty" required min="1">
          </div>
          <p id="receiveMsg" class="msg"></p>
          <button type="submit" class="btn btn-green">Add to Warehouse</button>
        </form>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>Transfer to Branch</h2>
        <form id="transferForm">
          <div class="field">
            <label>Product</label>
            <select id="transferSku" required></select>
          </div>
          <div class="field">
            <label>Branch</label>
            <select id="transferDestination" required>
              <option value="ST_UTTARA">Uttara Branch</option>
              <option value="ST_GULSHAN">Gulshan Branch</option>
            </select>
          </div>
          <div class="field">
            <label>Quantity</label>
            <input type="number" id="transferQty" required min="1">
          </div>
          <p id="transferMsg" class="msg"></p>
          <button type="submit" class="btn btn-dark">Transfer Stock</button>
        </form>
      </div>

      <div class="card">
        <h2>Update Selling Price</h2>
        <form id="priceForm">
          <div class="field">
            <label>Product</label>
            <select id="priceSku" required></select>
          </div>
          <div class="field">
            <label>New Price (BDT)</label>
            <input type="number" id="newSellingPrice" required min="0">
          </div>
          <p id="priceMsg" class="msg"></p>
          <button type="submit" class="btn btn-main">Save Price</button>
        </form>
      </div>
    </div>
    ${passwordCardHtml()}
  `;

  await refreshWarehouseScreen();

  bindPasswordForm(user);
  document.getElementById("addProductForm").addEventListener("submit", (e) => handleAddProduct(e, user));
  document.getElementById("receiveForm").addEventListener("submit", (e) => handleReceiveStock(e, user));
  document.getElementById("transferForm").addEventListener("submit", (e) => handleTransfer(e, user));
  document.getElementById("priceForm").addEventListener("submit", (e) => handleUpdatePrice(e, user));
  document.getElementById("warehouseSearch").addEventListener("input", applyWarehouseFilters);
  document.getElementById("warehouseCategoryFilter").addEventListener("change", applyWarehouseFilters);
  document.getElementById("warehouseLowOnly").addEventListener("change", applyWarehouseFilters);
}

async function refreshWarehouseScreen() {
  // Reload warehouse stock and the all-branch alert list.
  const [warehouseStock, allInventory] = await Promise.all([
    apiGet("/inventory?storeId=ST_WAREHOUSE"),
    apiGet("/inventory/all")
  ]);
  warehouseStockCache = warehouseStock;
  renderWarehouseStats(warehouseStock);
  renderLowStockBanner(allInventory);
  populateCategoryFilter(warehouseStock);
  applyWarehouseFilters();
  fillProductSelects(warehouseStock);
}

function renderWarehouseStats(stock) {
  // Update warehouse totals and low-stock count.
  const totalUnits = stock.reduce((sum, p) => sum + p.quantity, 0);
  const lowCount = stock.filter((p) => isLowStock(p.quantity, LOW_STOCK_LIMIT)).length;
  document.getElementById("warehouseStats").innerHTML = `
    <div class="stat stat-blue"><p>Products</p><strong>${stock.length}</strong></div>
    <div class="stat stat-gold"><p>Warehouse pieces</p><strong>${totalUnits}</strong></div>
    <div class="stat ${lowCount > 0 ? "stat-red" : "stat-green"}"><p>Low stock items</p><strong>${lowCount}</strong></div>
  `;
}

function fillProductSelects(stock) {
  const options = stock.map((p) =>
    `<option value="${p.sku}">${p.name} (${p.quantity} pcs · ${money(p.price)})</option>`
  ).join("");
  document.getElementById("transferSku").innerHTML = options;
  document.getElementById("receiveSku").innerHTML = options;
  document.getElementById("priceSku").innerHTML = options;
}

function populateCategoryFilter(stock) {
  const select = document.getElementById("warehouseCategoryFilter");
  const categories = [...new Set(stock.map((p) => p.category))].sort();
  fillSelect(select, categories, "All Categories");
}

function applyWarehouseFilters() {
  const search = document.getElementById("warehouseSearch").value;
  const category = document.getElementById("warehouseCategoryFilter").value;
  const lowOnly = document.getElementById("warehouseLowOnly").checked;
  const filtered = filterProducts(warehouseStockCache, search, category, lowOnly, LOW_STOCK_LIMIT);
  renderWarehouseStockTable(filtered);
}

function renderLowStockBanner(allInventory) {
  // Show which locations need stock attention.
  const lowItems = allInventory.filter((i) => isLowStock(i.quantity, LOW_STOCK_LIMIT));
  const banner = document.getElementById("lowStockBanner");

  if (lowItems.length === 0) {
    banner.innerHTML = `<div class="banner banner-ok">All items are above ${LOW_STOCK_LIMIT} pcs.</div>`;
    return;
  }

  const rows = lowItems.map((i) =>
    `<li><b>${i.name}</b> at ${i.storeName} — ${i.quantity} pcs left</li>`
  ).join("");

  banner.innerHTML = `
    <div class="banner banner-warn">
      <b>Low stock (${LOW_STOCK_LIMIT} or fewer):</b>
      <ul>${rows}</ul>
    </div>`;
}

function renderWarehouseStockTable(warehouseStock) {
  // Draw the filtered warehouse stock list.
  const tbody = document.getElementById("warehouseStockTableBody");
  if (warehouseStock.length === 0) {
    tbody.innerHTML = emptyRow(5, "No products match your search");
    return;
  }
  tbody.innerHTML = warehouseStock.map((p) => {
    const qtyClass = isLowStock(p.quantity, LOW_STOCK_LIMIT) ? "low-qty" : "";
    return `
      <tr>
        <td>${p.sku}</td>
        <td>${p.name}</td>
        <td>${categoryTag(p.category)}</td>
        <td>${money(p.price)}</td>
        <td class="${qtyClass}">${p.quantity}</td>
      </tr>`;
  }).join("");
}

async function handleAddProduct(e, user) {
  // Create a product with its opening warehouse quantity.
  e.preventDefault();
  const msg = document.getElementById("addProductMsg");
  const sku = document.getElementById("newSku").value.trim().toUpperCase();
  const name = document.getElementById("newName").value.trim();
  const category = document.getElementById("newCategory").value.trim();
  const price = Number(document.getElementById("newPrice").value);
  const initialQty = Number(document.getElementById("newQty").value);

  try {
    await apiPost("/products", { sku, name, category, price, initialQty, actingUsername: user.username });
    showMessage(msg, `"${name}" added.`, true);
    document.getElementById("addProductForm").reset();
    await refreshWarehouseScreen();
  } catch (err) {
    showMessage(msg, err.message, false);
  }
}

async function handleReceiveStock(e, user) {
  // Add newly received pieces to warehouse stock.
  e.preventDefault();
  const msg = document.getElementById("receiveMsg");
  const sku = document.getElementById("receiveSku").value;
  const qty = Number(document.getElementById("receiveQty").value);

  try {
    await apiPost("/inventory/adjust", {
      sku,
      storeId: "ST_WAREHOUSE",
      delta: qty,
      actingUsername: user.username,
      reason: "received from supplier"
    });
    showMessage(msg, `Received ${qty} pcs into warehouse.`, true);
    document.getElementById("receiveForm").reset();
    await refreshWarehouseScreen();
  } catch (err) {
    showMessage(msg, err.message, false);
  }
}

async function handleTransfer(e, user) {
  // Send warehouse pieces to a selected branch.
  e.preventDefault();
  const msg = document.getElementById("transferMsg");
  const sku = document.getElementById("transferSku").value;
  const destination = document.getElementById("transferDestination").value;
  const qty = Number(document.getElementById("transferQty").value);

  try {
    await apiPost("/inventory/transfer", {
      sku, fromStoreId: "ST_WAREHOUSE", toStoreId: destination, qty, actingUsername: user.username
    });
    showMessage(msg, `Transferred ${qty} pcs to ${getStoreNameById(destination)}.`, true);
    document.getElementById("transferForm").reset();
    await refreshWarehouseScreen();
  } catch (err) {
    showMessage(msg, err.message, false);
  }
}

async function handleUpdatePrice(e, user) {
  // Save a new selling price for the selected product.
  e.preventDefault();
  const msg = document.getElementById("priceMsg");
  const sku = document.getElementById("priceSku").value;
  const price = Number(document.getElementById("newSellingPrice").value);

  try {
    await apiPut(`/products/${sku}`, { price, actingUsername: user.username });
    showMessage(msg, `Price updated to ${money(price)}.`, true);
    document.getElementById("priceForm").reset();
    await refreshWarehouseScreen();
  } catch (err) {
    showMessage(msg, err.message, false);
  }
}
