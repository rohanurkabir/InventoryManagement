// --- OWNER DASHBOARD ---
async function renderOwnerDashboard(container, user) {
  // Build the owner view and connect its controls.
  container.innerHTML = `
    ${welcomeBanner(user)}
    <h2 class="page-title">Owner Dashboard</h2>
    <div class="toolbar">
      <label>Sales period
        <select id="salesDateFilter" class="filter-box">
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="all" selected>All Time</option>
        </select>
      </label>
      <button id="exportSalesBtn" class="tiny-btn tiny-pink" type="button">Download Sales CSV</button>
    </div>

    <div id="analyticsCards" class="grid-4"></div>

    <div class="grid-2">
      <div class="card">
        <h2>Store Performance</h2>
        <div class="scroll-table">
          <table>
            <thead>
              <tr><th>Store</th><th>Sales</th><th>Bills</th><th>Stock</th></tr>
            </thead>
            <tbody id="storeBreakdownBody"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h2>Top Selling Sarees</h2>
        <div class="scroll-table">
          <table>
            <thead>
              <tr><th>Product</th><th>Sold</th><th>Revenue</th></tr>
            </thead>
            <tbody id="topProductsBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2>User Accounts</h2>
        <div class="scroll-table">
          <table>
            <thead>
              <tr><th>Name</th><th>Username</th><th>Role</th><th>Store</th><th></th></tr>
            </thead>
            <tbody id="userTableBody"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h2>Add New User</h2>
        <form id="addUserForm">
          <div class="field">
            <label>Full Name</label>
            <input type="text" id="newUserFullName" required>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Username</label>
              <input type="text" id="newUserUsername" required>
            </div>
            <div class="field">
              <label>Password</label>
              <input type="text" id="newUserPassword" required>
            </div>
          </div>
          <div class="field">
            <label>Role</label>
            <select id="newUserRole" required>
              <option value="owner">Owner</option>
              <option value="shop_manager">Shop Manager</option>
              <option value="warehouse_manager">Warehouse Manager</option>
              <option value="cashier">POS Cashier</option>
            </select>
          </div>
          <div class="field">
            <label>Assigned Store</label>
            <select id="newUserStore">
              <option value="">None (Owner)</option>
              <option value="ST_UTTARA">Uttara Branch</option>
              <option value="ST_GULSHAN">Gulshan Branch</option>
              <option value="ST_WAREHOUSE">Central Warehouse</option>
            </select>
          </div>
          <p id="addUserMsg" class="msg"></p>
          <button type="submit" class="btn btn-main">Create User</button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <h2>Audit Log</h2>
        <input type="text" id="auditSearch" class="search-box" placeholder="Search username or action">
      </div>
      <div class="scroll-table">
        <table>
          <thead>
            <tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr>
          </thead>
          <tbody id="auditTableBody"></tbody>
        </table>
      </div>
    </div>
    ${passwordCardHtml()}
  `;

  await Promise.all([
    refreshAnalyticsAndBreakdown("all"),
    refreshTopProducts(),
    refreshUserTable(user),
    refreshAuditTable("")
  ]);

  bindPasswordForm(user);
  document.getElementById("addUserForm").addEventListener("submit", (e) => handleAddUser(e, user));
  document.getElementById("auditSearch").addEventListener("input", (e) => {
    refreshAuditTable(e.target.value.trim());
  });
  document.getElementById("salesDateFilter").addEventListener("change", (e) => {
    refreshAnalyticsAndBreakdown(e.target.value);
  });
  document.getElementById("exportSalesBtn").addEventListener("click", exportSalesCsv);
}

function getDateRangeFor(period) {
  // Convert the selected report period into API dates.
  if (period === "all") return null;

  const now = new Date();
  let from;
  if (period === "today") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "7days") {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

async function refreshAnalyticsAndBreakdown(period) {
  // Refresh summary cards and the store comparison table.
  const range = getDateRangeFor(period);
  const summaryUrl = range ? `/sales/summary?from=${range.from}&to=${range.to}` : "/sales/summary";

  const [summary, allInventory] = await Promise.all([
    apiGet(summaryUrl),
    apiGet("/inventory/all")
  ]);

  const totalRevenue = summary.reduce((sum, s) => sum + s.revenue, 0);
  const totalTransactions = summary.reduce((sum, s) => sum + s.transactions, 0);
  const totalStockUnits = allInventory.reduce((sum, i) => sum + i.quantity, 0);
  const lowStockCount = allInventory.filter((i) => isLowStock(i.quantity, LOW_STOCK_LIMIT)).length;

  document.getElementById("analyticsCards").innerHTML = `
    <div class="stat stat-pink"><p>Total Revenue</p><strong>${money(totalRevenue)}</strong></div>
    <div class="stat stat-blue"><p>Total Bills</p><strong>${totalTransactions}</strong></div>
    <div class="stat stat-gold"><p>Stock Units</p><strong>${totalStockUnits}</strong></div>
    <div class="stat ${lowStockCount > 0 ? "stat-red" : "stat-green"}"><p>Low Stock Alerts</p><strong>${lowStockCount}</strong></div>
  `;

  document.getElementById("storeBreakdownBody").innerHTML = summary.map((s) => {
    const stockUnits = allInventory
      .filter((i) => i.storeId === s.storeId)
      .reduce((sum, i) => sum + i.quantity, 0);
    return `
      <tr>
        <td>${s.storeName}</td>
        <td>${money(s.revenue)}</td>
        <td>${s.transactions}</td>
        <td>${stockUnits}</td>
      </tr>`;
  }).join("");
}

async function refreshTopProducts() {
  // Refresh the best-selling product table.
  const top = await apiGet("/sales/top");
  const body = document.getElementById("topProductsBody");
  if (top.length === 0) {
    body.innerHTML = emptyRow(3, "No sales yet");
    return;
  }
  body.innerHTML = top.map((p) => `
    <tr>
      <td>${p.name}</td>
      <td>${p.qtySold}</td>
      <td>${money(p.revenue)}</td>
    </tr>
  `).join("");
}

async function refreshUserTable(currentUser) {
  // Refresh accounts and protect the current account from deletion.
  const users = await apiGet("/users");
  document.getElementById("userTableBody").innerHTML = users.map((u) => {
    const storeName = u.storeId ? getStoreNameById(u.storeId) : "—";
    const deleteBtn = u.username === currentUser.username
      ? `<span class="tag tag-gray">you</span>`
      : `<button onclick="handleDeleteUser('${u.username}')" class="tiny-btn tiny-ghost">Delete</button>`;
    return `
      <tr>
        <td>${u.fullName}</td>
        <td>${u.username}</td>
        <td>${ROLE_LABELS[u.role]}</td>
        <td>${storeName}</td>
        <td>${deleteBtn}</td>
      </tr>`;
  }).join("");
}

async function handleAddUser(e, currentUser) {
  // Submit the new account form and refresh related tables.
  e.preventDefault();
  const msg = document.getElementById("addUserMsg");
  const fullName = document.getElementById("newUserFullName").value.trim();
  const username = document.getElementById("newUserUsername").value.trim();
  const password = document.getElementById("newUserPassword").value;
  const role = document.getElementById("newUserRole").value;
  const storeId = document.getElementById("newUserStore").value || null;

  try {
    await apiPost("/users", { fullName, username, password, role, storeId, actingUsername: currentUser.username });
    showMessage(msg, `User "${fullName}" created.`, true);
    document.getElementById("addUserForm").reset();
    await refreshUserTable(currentUser);
    await refreshAuditTable(document.getElementById("auditSearch").value.trim());
  } catch (err) {
    showMessage(msg, err.message, false);
  }
}

async function handleDeleteUser(username) {
  // Confirm and remove one staff account.
  if (!confirm(`Delete user "${username}"?`)) return;
  const currentUser = getSession();
  try {
    await apiDelete(`/users/${encodeURIComponent(username)}?actingUsername=${encodeURIComponent(currentUser.username)}`);
    await refreshUserTable(currentUser);
    await refreshAuditTable(document.getElementById("auditSearch").value.trim());
  } catch (err) {
    alert(err.message);
  }
}

async function refreshAuditTable(searchTerm) {
  // Show audit entries matching the owner's search.
  const logs = await apiGet(`/audit?search=${encodeURIComponent(searchTerm || "")}`);
  const tbody = document.getElementById("auditTableBody");
  if (logs.length === 0) {
    tbody.innerHTML = emptyRow(4, "No matching log entries");
    return;
  }
  tbody.innerHTML = logs.map((log) => `
    <tr>
      <td>${new Date(log.timestamp).toLocaleString()}</td>
      <td>${log.username}</td>
      <td><span class="tag tag-gray">${log.action}</span></td>
      <td>${log.details}</td>
    </tr>
  `).join("");
}

async function exportSalesCsv() {
  // Export the sales list for offline review.
  try {
    const sales = await apiGet("/sales");
    const rows = [["Sale ID", "Store", "Cashier", "Payment", "Discount", "Total", "Time"]];
    sales.forEach((s) => {
      rows.push([
        s.id,
        getStoreNameById(s.storeId),
        s.cashier,
        s.paymentMethod || "Cash",
        s.discount || 0,
        s.total,
        new Date(s.timestamp).toLocaleString()
      ]);
    });
    downloadCsv("rinaz-sales.csv", rows);
  } catch (err) {
    alert(err.message);
  }
}
