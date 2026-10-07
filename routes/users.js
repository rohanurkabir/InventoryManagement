const express = require("express");
const router = express.Router();
const q = require("../db/queries");
const { makeId, isBlank, MIN_PASSWORD_LENGTH } = require("../helpers");

// Owner: list accounts (password is not included).
router.get("/", (req, res) => {
  // Return account details without exposing passwords.
  res.json(q.getAllUsersSafe());
});

router.post("/", (req, res) => {
  // Validate and create a new staff account.
  const { fullName, username, password, role, storeId, actingUsername } = req.body;

  if (isBlank(fullName) || isBlank(username) || isBlank(password) || isBlank(role)) {
    return res.status(400).json({ error: "Please fill in every field." });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: "Password must be at least " + MIN_PASSWORD_LENGTH + " characters."
    });
  }

  if (q.findUserByUsername(username)) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const newUser = {
    id: makeId("U"),
    username,
    password,
    fullName,
    role,
    storeId: storeId || null
  };

  q.createUser(newUser);
  q.addAuditLog(actingUsername || "system", "ADD_USER", `Created new user "${username}" (${role})`);
  res.status(201).json({ id: newUser.id, username, fullName, role, storeId: newUser.storeId });
});

router.delete("/:username", (req, res) => {
  // Remove an account and record who removed it.
  const { username } = req.params;
  const actingUsername = req.query.actingUsername || "system";

  if (!q.findUserByUsername(username)) {
    return res.status(404).json({ error: "User not found." });
  }

  q.deleteUserByUsername(username);
  q.addAuditLog(actingUsername, "DELETE_USER", `Deleted user "${username}"`);
  res.json({ success: true });
});

module.exports = router;
