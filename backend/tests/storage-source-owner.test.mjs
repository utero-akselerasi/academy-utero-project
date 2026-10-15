import assert from "node:assert/strict";
import test from "node:test";
import { resolveSourceOwner } from "../src/storage/source-owner.mjs";

const OWNER = "a2e45379-d27d-4c3d-96fc-9f4061fb23a1";

test("source owner falls back to valid Supabase owner_id text", () => {
  assert.equal(resolveSourceOwner(null, OWNER), OWNER);
  assert.equal(resolveSourceOwner(OWNER, null), OWNER);
  assert.equal(resolveSourceOwner(null, null), null);
});

test("source owner rejects invalid or conflicting metadata", () => {
  assert.throws(() => resolveSourceOwner(null, "not-a-uuid"), /bukan UUID valid/);
  assert.throws(() => resolveSourceOwner(OWNER, "b9051d33-c375-44e8-99df-d5b0ab563f3e"), /konflik/);
});
