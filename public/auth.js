// --- LOGIN AND ROLE ROUTING ---

async function attemptLogin(username, password) {
  // Pass login details to the backend.
  return apiPost("/auth/login", { username, password });
}

function fillDemoLogin(username, password) {
  document.getElementById("loginUsername").value = username;
  document.getElementById("loginPassword").value = password;
}

function buildDemoButtons() {
  // Build quick login buttons for the sample accounts.
  const box = document.getElementById("demoAccounts");
  box.innerHTML = DEMO_ACCOUNTS.map((acc) =>
    `<button type="button" class="demo-chip" data-user="${acc.username}" data-pass="${acc.password}">${acc.label}</button>`
  ).join("");

  box.querySelectorAll(".demo-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      fillDemoLogin(btn.dataset.user, btn.dataset.pass);
    });
  });
}

// Open the correct screen from the user's role.
function routeToDashboard(user) {
  // Choose the dashboard that matches the user's role.
  const content = document.getElementById("dashboardContent");
  const topBarUser = document.getElementById("topBarUser");
  const topBarSubtitle = document.getElementById("topBarSubtitle");

  topBarUser.textContent = user.fullName + " · " + ROLE_LABELS[user.role];
  topBarSubtitle.textContent = getStoreNameById(user.storeId);
  setHeaderTheme(user.role);

  if (user.role === "owner") renderOwnerDashboard(content, user);
  else if (user.role === "shop_manager") renderShopManagerDashboard(content, user);
  else if (user.role === "warehouse_manager") renderWarehouseDashboard(content, user);
  else if (user.role === "cashier") renderPosDashboard(content, user);
}

function showAppShell() {
  // Hide login and show the main application area.
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
}

function showLoginScreen() {
  // Return to a clean login screen after logout.
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginForm").reset();
  document.getElementById("loginError").textContent = "";
}

function fillStudentLabels() {
  const loginLine = document.getElementById("studentLine");
  const footer = document.getElementById("footerText");
  if (loginLine) loginLine.textContent = "Prepared by " + STUDENT_NAME + " · " + STUDENT_ID;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Prepare shared page elements before the user signs in.
  fillStudentLabels();
  buildDemoButtons();
  startClock();

  try {
    await loadStoresCache();
  } catch (err) {
    console.error("Could not load stores:", err);
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorBox = document.getElementById("loginError");
    errorBox.textContent = "";

    try {
      const user = await attemptLogin(username, password);
      setSession(user);
      showAppShell();
      routeToDashboard(user);
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    const user = getSession();
    if (user) {
      try {
        await apiPost("/auth/logout", { username: user.username, fullName: user.fullName });
      } catch (err) {
        console.error(err);
      }
    }
    clearSession();
    showLoginScreen();
  });

  const existingUser = getSession();
  if (existingUser) {
    showAppShell();
    routeToDashboard(existingUser);
  } else {
    showLoginScreen();
  }
});
