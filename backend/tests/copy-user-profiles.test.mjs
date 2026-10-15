import assert from "node:assert/strict";
import test from "node:test";
import { assertUniqueEmails, copyUserProfiles, databaseIdentity, normalizeEmail, profileForUser, resolveCopyConfig } from "../scripts/copy-user-profiles.mjs";

test("config copy profile wajib eksplisit dan source berbeda", () => {
  const base = {
    SOURCE_DATABASE_URL: "postgres://reader@source/academy",
    TARGET_DATABASE_URL: "postgres://writer@target/academy",
    CONFIRM_USER_PROFILE_COPY: "copy-user-profiles-only",
  };
  assert.deepEqual(resolveCopyConfig(base), { sourceUrl: base.SOURCE_DATABASE_URL, targetUrl: base.TARGET_DATABASE_URL });
  assert.equal(databaseIdentity("postgres://reader@SOURCE/academy"), "source:5432/academy");
  assert.throws(() => resolveCopyConfig({ ...base, TARGET_DATABASE_URL: "postgres://writer@source:5432/academy" }), /tidak boleh sama/);
  assert.throws(() => resolveCopyConfig({ ...base, CONFIRM_USER_PROFILE_COPY: "wrong" }), /copy-user-profiles-only/);
});

test("email dinormalisasi dan duplikat case-insensitive ditolak", () => {
  assert.equal(normalizeEmail(" User@Example.COM "), "user@example.com");
  assert.throws(() => normalizeEmail("bad\n@example.com"), /tidak valid/);
  assert.throws(() => assertUniqueEmails([{ email: "user@example.com" }, { email: "USER@example.com" }]), /duplikat/);
});

test("profile memakai nama source dan tidak membuat nama palsu", () => {
  const base = { id: "one", email: "user@example.com", created_at: "2026-01-01", updated_at: "2026-01-02", is_active: true };
  assert.equal(profileForUser({ ...base, full_name: "Nama Profile" }).fullName, "Nama Profile");
  assert.throws(() => profileForUser(base), /Nama profile source tidak valid/);
});

test("copy hanya membawa identitas dan profil Academy tanpa hash password atau role source", async () => {
  const sourceQueries = [];
  const targetQueries = [];
  const profile = {
    id: "00000000-0000-4000-8000-000000000001", email: "USER@example.com", full_name: "Nama Pengguna",
    phone: "0812", avatar_path: "avatar-lama.png", is_active: true,
    created_at: "2026-01-01", updated_at: "2026-01-02",
  };
  const source = { async query(sql) {
    sourceQueries.push(sql);
    if (sql.startsWith("select current_database()")) return { rows: [{ identity: "source|1|5432" }] };
    if (sql.includes("from utero_academy.user_profiles profiles")) return { rows: [profile], rowCount: 1 };
    return { rows: [] };
  } };
  const target = { async query(sql, params) {
    targetQueries.push({ sql, params });
    if (sql.startsWith("select current_database()")) return { rows: [{ identity: "target|2|5432" }] };
    if (sql.includes("(select count(*)::int from auth.users)")) return { rows: [{ users: 0, profiles: 0, assignments: 0 }] };
    return { rows: [] };
  } };
  const result = await copyUserProfiles(source, target);
  assert.deepEqual([result.users, result.profiles, result.avatarsCleared, result.passwordHashesCopied, result.roleAssignmentsCopied], [1, 1, 1, 0, 0]);
  const writes = targetQueries.filter(({ sql }) => sql.includes("insert into"));
  assert.deepEqual(writes.map(({ sql }) => /insert into ([a-z_.]+)/.exec(sql)[1]), ["auth.users", "auth.identities", "utero_academy.user_profiles"]);
  assert.match(writes[0].sql, /null,null/);
  assert.match(writes[2].sql, /null,\$4/);
  assert.equal(sourceQueries.some((sql) => sql.includes("encrypted_password")), false);
  assert.equal(targetQueries.at(-1).sql, "commit");
});

test("copy menolak target nonkosong dan menggugurkan transaksi", async () => {
  const source = { async query(sql) {
    if (sql.startsWith("select current_database()")) return { rows: [{ identity: "source|1|5432" }] };
    if (sql.includes("from utero_academy.user_profiles profiles")) return { rows: [{ id: "one", email: "one@example.com", full_name: "One", is_active: true }], rowCount: 1 };
    return { rows: [] };
  } };
  const statements = [];
  const target = { async query(sql) {
    statements.push(sql);
    if (sql.startsWith("select current_database()")) return { rows: [{ identity: "target|2|5432" }] };
    if (sql.includes("(select count(*)::int from auth.users)")) return { rows: [{ users: 1, profiles: 0, assignments: 0 }] };
    return { rows: [] };
  } };
  await assert.rejects(() => copyUserProfiles(source, target), /Target wajib kosong/);
  assert.equal(statements.at(-1), "rollback");
  assert.equal(statements.some((sql) => sql.includes("insert into")), false);
});
