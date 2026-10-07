// --- API HELPERS ---
// Every dashboard talks to the backend through these fetch functions.
const API_BASE = "/api";
const SESSION_KEY = "rinaz_session";

async function apiGet(path) {
  // Send a GET request and show backend errors clearly.
  const res = await fetch(API_BASE + path);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function apiPost(path, body) {
  // Send new data to the backend.
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function apiPut(path, body) {
  // Send an update to the backend.
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function apiDelete(path) {
  // Ask the backend to remove a record.
  const res = await fetch(API_BASE + path, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// --- LOGIN SESSION (browser memory until tab is closed) ---
function setSession(user) {
  // Keep the logged-in user while this browser tab is open.
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getSession() {
  // Read the saved user, if this tab already has one.
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  // End the current browser session.
  sessionStorage.removeItem(SESSION_KEY);
}

// --- STORE NAMES ---
let storesCache = null;

async function loadStoresCache() {
  // Load store names once so dashboards can reuse them.
  storesCache = await apiGet("/stores");
  return storesCache;
}

function getStoreNameById(storeId) {
  if (!storeId) return "All Stores";
  if (!storesCache) return storeId;
  const store = storesCache.find((s) => s.id === storeId);
  return store ? store.name : "Unknown Store";
}

function showMessage(element, text, isSuccess) {
  // Display a small success or error message beside a form.
  element.textContent = text;
  element.className = "msg " + (isSuccess ? "ok" : "bad");
}
