import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { tokenDigest, sendVerificationEmail, smtpTransportOptions } from "../src/auth/email.mjs";
import { authRoutes } from "../src/routes/auth.mjs";

function verificationDatabase() {
  const state = { consumed: false, confirmed: false };
  const client = {
    async query(sql) {
      if (sql.includes("select token.user_id")) {
        return { rows: state.consumed || state.confirmed ? [] : [{ user_id: "00000000-0000-4000-8000-000000000001" }] };
      }
      if (sql.includes("set consumed_at")) state.consumed = true;
      if (sql.includes("set email_confirmed_at")) state.confirmed = true;
      return { rows: [] };
    },
  };
  return {
    state,
    async apiTransaction(callback) { return callback(client); },
    async query() { return { rows: [] }; },
  };
}

test("token verifikasi hanya dapat dipakai sekali", async () => {
  const db = verificationDatabase();
  const app = Fastify();
  await app.register(authRoutes, { db, config: { sessionCookie: "test", sessionTtlSeconds: 60, secureCookies: false } });
  const token = "a".repeat(64);
  const first = await app.inject({ method: "POST", url: "/v1/auth/verify-email", payload: { token } });
  const reused = await app.inject({ method: "POST", url: "/v1/auth/verify-email", payload: { token } });
  assert.equal(first.statusCode, 200);
  assert.equal(reused.statusCode, 400);
  assert.equal(db.state.confirmed, true);
  await app.close();
});

test("token disimpan sebagai digest dan format buruk ditolak", async () => {
  assert.match(tokenDigest("secret"), /^[a-f0-9]{64}$/);
  assert.notEqual(tokenDigest("secret"), "secret");
  const db = verificationDatabase();
  const app = Fastify();
  await app.register(authRoutes, { db, config: {} });
  const response = await app.inject({ method: "POST", url: "/v1/auth/verify-email", payload: { token: "bad" } });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test("SMTP tanpa konfigurasi gagal eksplisit", async () => {
  await assert.rejects(() => sendVerificationEmail({ smtp: {}, publicAppUrl: "https://example.com" }, "user@example.com", "a".repeat(64)));
});

test("SMTP production mewajibkan TLS pada port 587 dan SMTPS pada port 465", () => {
  assert.equal(smtpTransportOptions({ host: "mail.example.com", port: 587 }).requireTLS, true);
  assert.equal(smtpTransportOptions({ host: "mail.example.com", port: 587 }).secure, false);
  assert.equal(smtpTransportOptions({ host: "mail.example.com", port: 465 }).secure, true);
  assert.throws(() => smtpTransportOptions({ host: "mail.example.com", port: 25 }), /requires port 465 or 587/);
});

test("login hanya mencari pengguna yang sudah terkonfirmasi", async () => {
  let loginSql = "";
  const db = {
    async query(sql) { loginSql = sql; return { rows: [] }; },
    async apiTransaction() { throw new Error("unexpected transaction"); },
  };
  const app = Fastify();
  await app.register(authRoutes, { db, config: {} });
  const response = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "user@example.com", password: "password" } });
  assert.equal(response.statusCode, 401);
  assert.match(loginSql, /email_confirmed_at is not null/);
  await app.close();
});

test("signup tidak menyatakan terkirim saat SMTP gagal", async () => {
  const client = {
    async query(sql) {
      if (sql.includes("select 1 from auth.users")) return { rows: [] };
      if (sql.includes("insert into auth.users")) return { rows: [{ id: "00000000-0000-4000-8000-000000000001", email: "user@example.com" }] };
      return { rows: [] };
    },
  };
  const db = {
    async apiTransaction(callback) { return callback(client); },
    async query() { return { rows: [] }; },
  };
  const app = Fastify();
  await app.register(authRoutes, { db, config: { smtp: {}, publicAppUrl: "https://example.com" } });
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/signup",
    payload: { fullName: "Nama Pengguna", email: "user@example.com", password: "password-kuat-123" },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "verification_email_unavailable");
  await app.close();
});
