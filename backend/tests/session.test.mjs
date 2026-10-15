import assert from "node:assert/strict";
import test from "node:test";
import { readCookie, sessionCookie } from "../src/auth/session.mjs";

test("session cookie secure and HttpOnly", () => {
  const header = sessionCookie("utero_session", "token", 60, true);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.equal(readCookie(header, "utero_session"), "token");
});

test("malformed cookie ignored", () => {
  assert.equal(readCookie("utero_session=%bad", "utero_session"), null);
});
