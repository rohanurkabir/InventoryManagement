// Shared UI helpers used by owner, shop, warehouse, and POS screens.

function money(amount) {
  // Format all prices with the app currency.
  return CURRENCY + Number(amount).toLocaleString();
}

function isLowStock(qty, limit) {
  return qty <= limit;
}

function categoryClass(category) {
  const map = {
    Jamdani: "tag-pink",
    Muslin: "tag-sky",
    Silk: "tag-purple",
    Bridal: "tag-gold",
    Tant: "tag-orange",
    "Party Wear": "tag-rose",
    Cotton: "tag-green",
    Casual: "tag-teal"
  };
  return map[category] || "tag-gray";
}

function categoryTag(category) {
  return `<span class="tag ${categoryClass(category)}">${category}</span>`;
}

function startClock() {
  // Keep the header clock current.
  const el = document.getElementById("topBarClock");
  if (!el) return;
  function tick() {
    el.textContent = new Date().toLocaleString();
  }
  tick();
  setInterval(tick, 1000);
}

function setHeaderTheme(role) {
  // Match the header color to the logged-in role.
  const header = document.getElementById("appHeader");
  header.classList.remove("theme-owner", "theme-shop", "theme-warehouse", "theme-pos");
  if (role === "owner") header.classList.add("theme-owner");
  else if (role === "shop_manager") header.classList.add("theme-shop");
  else if (role === "warehouse_manager") header.classList.add("theme-warehouse");
  else header.classList.add("theme-pos");
}

function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" class="empty-row">${text}</td></tr>`;
}

// Shown at the top of every dashboard after login.
function welcomeBanner(user) {
  return `
    <div class="welcome-strip">
      <div>
        <strong>Welcome, ${user.fullName}</strong>
        <span> · ${ROLE_LABELS[user.role]}</span>
      </div>
      <div class="welcome-meta">${APP_NAME} · ${UNIVERSITY_LINE} · ${STUDENT_NAME}</div>
    </div>`;
}

// Password form reused on owner / shop / warehouse / POS pages.
function passwordCardHtml() {
  return `
    <div class="card password-card">
      <h2>Change My Password</h2>
      <form id="changePasswordForm" class="grid-3">
        <div class="field">
          <label>Current password</label>
          <input type="password" id="oldPassword" required>
        </div>
        <div class="field">
          <label>New password</label>
          <input type="password" id="newPassword" required minlength="${MIN_PASSWORD_LENGTH}">
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button type="submit" class="btn btn-dark">Update Password</button>
        </div>
      </form>
      <p id="passwordMsg" class="msg"></p>
    </div>`;
}

function bindPasswordForm(user) {
  const form = document.getElementById("changePasswordForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("passwordMsg");
    const oldPassword = document.getElementById("oldPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    try {
      await apiPost("/auth/password", {
        username: user.username,
        oldPassword,
        newPassword
      });
      showMessage(msg, "Password updated. Use the new password next login.", true);
      form.reset();
    } catch (err) {
      showMessage(msg, err.message, false);
    }
  });
}

function filterProducts(list, searchText, category, lowOnly, lowLimit) {
  // Apply the shared search, category, and low-stock filters.
  const search = (searchText || "").trim().toLowerCase();
  return list.filter((p) => {
    const matchesSearch = !search ||
      p.sku.toLowerCase().includes(search) ||
      p.name.toLowerCase().includes(search);
    const matchesCategory = !category || p.category === category;
    const matchesLow = !lowOnly || isLowStock(p.quantity, lowLimit);
    return matchesSearch && matchesCategory && matchesLow;
  });
}

function fillSelect(select, values, allLabel) {
  const current = select.value;
  select.innerHTML = `<option value="">${allLabel}</option>` +
    values.map((v) => `<option value="${v}">${v}</option>`).join("");
  select.value = current;
}

function downloadCsv(filename, rows) {
  // Turn table data into a downloadable CSV file.
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
