import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, needsPasswordRehash, verifyPassword } from "../src/auth/password.mjs";

test("password scrypt roundtrip", async () => {
  const encoded = await hashPassword("password-yang-panjang");
  assert.equal(await verifyPassword("password-yang-panjang", encoded), true);
  assert.equal(await verifyPassword("salah", encoded), false);
  assert.equal(needsPasswordRehash(encoded), false);
});
