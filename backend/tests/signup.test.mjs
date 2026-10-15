import assert from "node:assert/strict";
import test from "node:test";
import { parseSignup } from "../src/auth/signup.mjs";

test("signup input dinormalisasi", () => {
  assert.deepEqual(parseSignup({
    fullName: "  Budi   Santoso ",
    email: " BUDI@example.com ",
    password: "password-kuat-123",
  }), {
    value: {
      fullName: "Budi Santoso",
      email: "budi@example.com",
      password: "password-kuat-123",
    },
  });
});

test("signup menolak data lemah", () => {
  assert.equal(parseSignup({ fullName: "A", email: "invalid", password: "pendek" }).error, "invalid_full_name");
  assert.equal(parseSignup({ fullName: "Nama Valid", email: "invalid", password: "password-kuat-123" }).error, "invalid_email");
  assert.equal(parseSignup({ fullName: "Nama Valid", email: "nama@example.com", password: "pendek" }).error, "invalid_password");
});
