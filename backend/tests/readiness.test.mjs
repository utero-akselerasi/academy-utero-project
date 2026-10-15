import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkReadiness } from "../src/readiness.mjs";

test("readiness requires application schema and writable storage", async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "academy-ready-"));
  const db = { query: async () => ({ rows: [{ a: "auth.users", b: "utero_academy.roles", c: "utero_academy.user_profiles", d: "academy_storage.objects", e: "public.academy_backend_migrations" }] }) };
  try {
    await checkReadiness(db, storageRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
});

test("readiness rejects incomplete schema", async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "academy-ready-"));
  const db = { query: async () => ({ rows: [{ a: "auth.users", b: null, c: "utero_academy.user_profiles", d: "academy_storage.objects", e: "public.academy_backend_migrations" }] }) };
  try {
    await assert.rejects(checkReadiness(db, storageRoot), /schema aplikasi belum lengkap/);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
});
