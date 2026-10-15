import assert from "node:assert/strict";
import test from "node:test";
import { inviteImportedUser } from "../src/auth/activation.mjs";

function database({ user = { id: "user-id", email: "user@example.com" }, hasRole = true } = {}) {
  const state = { tokenInserted: false };
  const client = {
    async query(sql) {
      if (sql.includes("select id,email from auth.users")) return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      if (sql.includes("from utero_academy.user_roles")) return { rows: hasRole ? [{}] : [], rowCount: hasRole ? 1 : 0 };
      if (sql.includes("insert into auth.account_invitation_tokens")) state.tokenInserted = true;
      return { rows: [], rowCount: 0 };
    },
  };
  return { state, async apiTransaction(callback) { return callback(client); } };
}

test("aktivasi user impor memerlukan role lalu mengirim undangan", async () => {
  const db = database();
  let recipient;
  const result = await inviteImportedUser(db, {}, "user-id", async (_, email) => { recipient = email; });
  assert.equal(result.status, 201);
  assert.equal(recipient, "user@example.com");
  assert.equal(db.state.tokenInserted, true);
});

test("aktivasi user impor menolak user tanpa role", async () => {
  const result = await inviteImportedUser(database({ hasRole: false }), {}, "user-id", async () => assert.fail("tidak boleh mengirim"));
  assert.deepEqual(result, { status: 409, error: "role_required" });
});

test("aktivasi user impor menolak akun yang tidak lagi pending", async () => {
  const result = await inviteImportedUser(database({ user: null }), {}, "user-id", async () => assert.fail("tidak boleh mengirim"));
  assert.deepEqual(result, { status: 404, error: "pending_user_not_found" });
});
