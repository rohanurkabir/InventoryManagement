const express = require("express");
const router = express.Router();
const q = require("../db/queries");
const { isBlank, MIN_PASSWORD_LENGTH } = require("../helpers");

// Check username + password, then return the user's role (no password sent back).
router.post("/login", (req, res) => {
  // Check credentials and return only safe user details.
  const { username, password } = req.body;
  const user = q.findUserByUsername(username);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  q.addAuditLog(user.username, "LOGIN", user.full_name + " logged in");

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    storeId: user.store_id
  });
});

router.post("/logout", (req, res) => {
  // Record the logout event before ending the browser session.
  const { username, fullName } = req.body;
  q.addAuditLog(username, "LOGOUT", fullName + " logged out");
  res.json({ success: true });
});

// Logged-in user changes their own password.
router.post("/password", (req, res) => {
  // Verify the old password before saving a new one.
  const { username, oldPassword, newPassword } = req.body;
  const user = q.findUserByUsername(username);

  if (!user || user.password !== oldPassword) {
    return res.status(401).json({ error: "Current password is wrong." });
  }
  if (isBlank(newPassword) || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: "New password must be at least " + MIN_PASSWORD_LENGTH + " characters."
    });
  }

  q.updateUserPassword(username, newPassword);
  q.addAuditLog(username, "PASSWORD", user.full_name + " changed password");
  res.json({ success: true });
});

module.exports = router;
