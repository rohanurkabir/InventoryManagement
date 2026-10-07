// Small values used by more than one backend file.

function makeId(prefix) {
  // Create a simple unique ID for records and logs.
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

function isBlank(value) {
  // Treat missing values and spaces as empty input.
  return value == null || String(value).trim() === "";
}

const DISCOUNT_MAX = 20;          // POS cannot give more than 20%
const MIN_PASSWORD_LENGTH = 4;

module.exports = { makeId, isBlank, DISCOUNT_MAX, MIN_PASSWORD_LENGTH };
