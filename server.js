// --- SERVER START ---
// This file starts Express and connects every API group to a route file.
const express = require("express");
const cors = require("cors");
const db = require("./db/init");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + "/public")); // login page + dashboards

// --- SMALL INFO APIS ---
app.get("/api/health", (req, res) => {
  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  res.json({
    status: "ok",
    message: "Rinaz backend is running",
    usersInDatabase: userCount
  });
});

app.get("/api/about", (req, res) => {
  res.json({
    app: "Rinaz",
    university: "IUBAT",
    type: "Practicum Project"
  });
});

// --- MAIN API GROUPS ---
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/stores", require("./routes/stores"));
app.use("/api/products", require("./routes/products"));
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/audit", require("./routes/audit"));

// --- UNKNOWN URL ---
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "This page was not found." });
  }
  res.status(404).send("Page not found.");
});

app.listen(PORT, () => {
  console.log("Rinaz is running at http://localhost:" + PORT);
});
