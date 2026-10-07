let cartItems = [];
let currentStoreInventory = [];
let lastCompletedSale = null;

async function renderPosDashboard(container, user) {
  // Build the checkout screen and reset the previous cart.
  cartItems = [];
  lastCompletedSale = null;

  container.innerHTML = `
    ${welcomeBanner(user)}
    <h2 class="page-title">POS — ${getStoreNameById(user.storeId)}</h2>
    <div class="grid-2" style="grid-template-columns: 2fr 1fr;">
      <div class="card">
        <div class="toolbar">
          <h2>Products</h2>
          <div class="toolbar-right">
            <label class="low-check"><input type="checkbox" id="posLowOnly"> Low stock only</label>
            <input type="text" id="posSearch" class="search-box" placeholder="Search SKU or name">
            <select id="posCategoryFilter" class="filter-box">
              <option value="">All Categories</option>
            </select>
          </div>
        </div>
        <div class="scroll-table">
          <table>
            <thead>
              <tr><th>SKU</th><th>Product</th><th>Price</th><th>Stock</th><th>Qty</th><th></th></tr>
            </thead>
            <tbody id="posProductTableBody"></tbody>
          </table>
        </div>
        <p id="posAddMsg" class="msg"></p>
      </div>

      <div class="card">
        <h2>Current Sale</h2>
        <div class="field">
          <label>Payment</label>
          <select id="paymentMethod">
            ${PAYMENT_METHODS.map((m) => `<option value="${m}">${m}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Discount % (max ${DISCOUNT_MAX})</label>
          <input type="number" id="discountPercent" min="0" max="${DISCOUNT_MAX}" value="0">
        </div>
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Subtotal</th><th></th></tr>
          </thead>
          <tbody id="cartTableBody">
            <tr><td colspan="4" class="empty-row">Cart is empty</td></tr>
          </tbody>
        </table>
        <div class="totals-box">
          <p><span>Subtotal</span><span id="cartSubtotal">${money(0)}</span></p>
          <p><span>Discount</span><span id="cartDiscount">${money(0)}</span></p>
          <p style="font-size:18px;font-weight:700;"><span>Payable</span><span id="cartTotal">${money(0)}</span></p>
        </div>
        <button id="checkoutBtn" class="btn btn-green" disabled>Process Sale</button>
        <button id="clearCartBtn" class="btn btn-dark" style="margin-top:8px;">Clear Cart</button>
        <p id="checkoutMsg" class="msg"></p>
      </div>
    </div>
    ${passwordCardHtml()}
  `;

  await refreshPosProductList(user);
  bindPasswordForm(user);
  document.getElementById("checkoutBtn").addEventListener("click", () => handleCheckout(user));
  document.getElementById("clearCartBtn").addEventListener("click", clearCart);
  document.getElementById("posSearch").addEventListener("input", applyPosFilters);
  document.getElementById("posCategoryFilter").addEventListener("change", applyPosFilters);
  document.getElementById("posLowOnly").addEventListener("change", applyPosFilters);
  document.getElementById("discountPercent").addEventListener("input", renderCartTable);
}

async function refreshPosProductList(user) {
  // Reload products available at the cashier's branch.
  currentStoreInventory = await apiGet(`/inventory?storeId=${user.storeId}`);
  populatePosCategoryFilter();
  applyPosFilters();
}

function populatePosCategoryFilter() {
  const select = document.getElementById("posCategoryFilter");
  const categories = [...new Set(currentStoreInventory.map((p) => p.category))].sort();
  fillSelect(select, categories, "All Categories");
}

function getDiscountPercent() {
  let percent = Number(document.getElementById("discountPercent").value) || 0;
  if (percent < 0) percent = 0;
  if (percent > DISCOUNT_MAX) percent = DISCOUNT_MAX;
  return percent;
}

function applyPosFilters() {
  // Filter products before drawing the POS table.
  const search = document.getElementById("posSearch").value;
  const category = document.getElementById("posCategoryFilter").value;
  const lowOnly = document.getElementById("posLowOnly").checked;
  const filtered = filterProducts(currentStoreInventory, search, category, lowOnly, SHOP_LOW_STOCK);
  renderPosProductTable(filtered);
}

function renderPosProductTable(products) {
  // Draw products with quantity controls and add buttons.
  const tbody = document.getElementById("posProductTableBody");
  if (products.length === 0) {
    tbody.innerHTML = emptyRow(6, "No products match your search");
    return;
  }
  tbody.innerHTML = products.map((p) => {
    const rowClass = isLowStock(p.quantity, SHOP_LOW_STOCK) ? "low-row" : "";
    const qtyClass = isLowStock(p.quantity, SHOP_LOW_STOCK) ? "low-qty" : "";
    const addDisabled = p.quantity === 0 ? "disabled" : "";
    return `
      <tr class="${rowClass}">
        <td>${p.sku}</td>
        <td>${p.name}</td>
        <td>${money(p.price)}</td>
        <td class="${qtyClass}">${p.quantity}</td>
        <td><input type="number" min="1" value="1" id="qty-${p.sku}" style="width:64px"></td>
        <td><button onclick="handleAddToCart('${p.sku}')" ${addDisabled} class="tiny-btn tiny-pink">Add</button></td>
      </tr>`;
  }).join("");
}

function handleAddToCart(sku) {
  // Add the requested quantity without exceeding available stock.
  const msg = document.getElementById("posAddMsg");
  const qtyToAdd = Number(document.getElementById("qty-" + sku).value);
  if (qtyToAdd <= 0) return showMessage(msg, "Quantity must be at least 1.", false);

  const product = currentStoreInventory.find((p) => p.sku === sku);
  const existingCartLine = cartItems.find((c) => c.sku === sku);
  const alreadyInCart = existingCartLine ? existingCartLine.qty : 0;

  if (alreadyInCart + qtyToAdd > product.quantity) {
    return showMessage(msg, `Only ${product.quantity} pcs available.`, false);
  }

  if (existingCartLine) existingCartLine.qty += qtyToAdd;
  else cartItems.push({ sku, name: product.name, price: product.price, qty: qtyToAdd });

  showMessage(msg, `Added ${qtyToAdd} × ${product.name}.`, true);
  renderCartTable();
}

function cartTotal() {
  return cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function renderCartTable() {
  // Recalculate and display the current bill.
  const tbody = document.getElementById("cartTableBody");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (cartItems.length === 0) {
    tbody.innerHTML = emptyRow(4, "Cart is empty");
    document.getElementById("cartSubtotal").textContent = money(0);
    document.getElementById("cartDiscount").textContent = money(0);
    document.getElementById("cartTotal").textContent = money(0);
    checkoutBtn.disabled = true;
    return;
  }

  tbody.innerHTML = cartItems.map((item, index) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>${money(item.price * item.qty)}</td>
      <td><button onclick="removeFromCart(${index})" class="tiny-btn tiny-ghost">✕</button></td>
    </tr>
  `).join("");

  const subtotal = cartTotal();
  const discount = Math.round(subtotal * getDiscountPercent() / 100);
  document.getElementById("cartSubtotal").textContent = money(subtotal);
  document.getElementById("cartDiscount").textContent = money(discount);
  document.getElementById("cartTotal").textContent = money(subtotal - discount);
  checkoutBtn.disabled = false;
}

function removeFromCart(index) {
  cartItems.splice(index, 1);
  renderCartTable();
}

function clearCart() {
  cartItems = [];
  renderCartTable();
  showMessage(document.getElementById("checkoutMsg"), "Cart cleared.", true);
}

async function handleCheckout(user) {
  // Send the cart to the backend and refresh stock after checkout.
  const msg = document.getElementById("checkoutMsg");
  if (cartItems.length === 0) {
    return showMessage(msg, "Cart is empty.", false);
  }

  try {
    const sale = await apiPost("/sales", {
      storeId: user.storeId,
      cashier: user.username,
      paymentMethod: document.getElementById("paymentMethod").value,
      discountPercent: getDiscountPercent(),
      items: cartItems.map((i) => ({ sku: i.sku, qty: i.qty }))
    });
    lastCompletedSale = sale;

    msg.className = "msg ok";
    msg.innerHTML = `Sale done. Payable ${money(sale.total)}. <button onclick="printReceipt()" class="tiny-btn tiny-pink">Print Receipt</button>`;

    cartItems = [];
    renderCartTable();
    await refreshPosProductList(user);
  } catch (err) {
    showMessage(msg, err.message, false);
  }
}

function printReceipt() {
  // Open a small printable receipt for the completed sale.
  if (!lastCompletedSale) return;

  const user = getSession();
  const sale = lastCompletedSale;
  const storeName = getStoreNameById(user.storeId);
  const payment = sale.paymentMethod || "Cash";

  const itemRows = sale.items.map((item) => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">${money(item.price)}</td>
      <td style="text-align:right">${money(item.price * item.qty)}</td>
    </tr>
  `).join("");

  const receiptWindow = window.open("", "_blank", "width=380,height=600");
  if (!receiptWindow) {
    alert("Allow pop-ups to print the receipt.");
    return;
  }
  receiptWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt ${sale.id}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; width: 280px; margin: 0 auto; }
          h1 { text-align: center; margin: 0; font-size: 20px; color: #be185d; }
          p { text-align: center; margin: 2px 0; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
          th { border-bottom: 1px solid #000; text-align: left; padding-bottom: 4px; }
          td { padding: 3px 0; }
          tfoot td { border-top: 1px solid #000; font-weight: bold; padding-top: 6px; }
        </style>
      </head>
      <body>
        <h1>${APP_NAME}</h1>
        <p>${storeName}</p>
        <p>${UNIVERSITY_LINE}</p>
        <p>Cashier: ${user.fullName}</p>
        <p>Payment: ${payment}</p>
        <p>${new Date(sale.timestamp).toLocaleString()}</p>
        <p>Receipt #${sale.id}</p>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr><td colspan="3">Subtotal</td><td style="text-align:right">${money(sale.subtotal || sale.total)}</td></tr>
            <tr><td colspan="3">Discount</td><td style="text-align:right">${money(sale.discount || 0)}</td></tr>
            <tr><td colspan="3">Grand Total</td><td style="text-align:right">${money(sale.total)}</td></tr>
          </tfoot>
        </table>
        <p style="margin-top:18px">Thank you for shopping with Rinaz!</p>
      </body>
    </html>
  `);
  receiptWindow.document.close();
  receiptWindow.focus();
  receiptWindow.print();
}
