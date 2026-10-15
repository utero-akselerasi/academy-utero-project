import assert from "node:assert/strict";
import test from "node:test";
import { resolveBootstrapConfig } from "../scripts/bootstrap-super-admin.mjs";

test("bootstrap super-admin memerlukan konfirmasi dan password kuat", () => {
  const base = {
    DATABASE_URL: "postgres://postgres@postgres/academy",
    BOOTSTRAP_SUPER_ADMIN_EMAIL: "Admin@Example.com",
    BOOTSTRAP_SUPER_ADMIN_PASSWORD: "password-sangat-kuat",
    CONFIRM_BOOTSTRAP_SUPER_ADMIN: "bootstrap-initial-super-admin",
  };
  assert.equal(resolveBootstrapConfig(base).email, "admin@example.com");
  assert.throws(() => resolveBootstrapConfig({ ...base, CONFIRM_BOOTSTRAP_SUPER_ADMIN: "wrong" }), /bootstrap-initial-super-admin/);
  assert.throws(() => resolveBootstrapConfig({ ...base, BOOTSTRAP_SUPER_ADMIN_PASSWORD: "terlalu-pendek" }), /16-128/);
});
