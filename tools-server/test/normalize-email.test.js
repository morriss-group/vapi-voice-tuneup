import { test } from "node:test";
import assert from "node:assert/strict";
process.env.NODE_TEST = "1";
process.env.SHARED_SECRET = "test-only-secret";
const { normalizeEmail } = await import("../server.js");

test("strips the space a read-back leaks into an address", () => {
  assert.equal(normalizeEmail("jordan.l ee@example.com"), "jordan.lee@example.com");
});
test("folds spoken at and dot, lowercases", () => {
  assert.equal(normalizeEmail("Sam Rivera at example dot com"), "samrivera@example.com");
});
test("returns null for something that is not an address, so the booking can proceed without one", () => {
  assert.equal(normalizeEmail("no idea"), null);
  assert.equal(normalizeEmail(""), null);
  assert.equal(normalizeEmail(undefined), null);
});
