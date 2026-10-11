import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backfill = readFileSync(
  resolve(process.cwd(), "supabase/manual/B0.3b_backfill_storage_paths.sql"),
  "utf8",
);

describe("storage backfill snapshot security", () => {
  it("enables RLS on snapshot before recording sensitive paths", () => {
    const create = backfill.indexOf("create table if not exists utero_academy.storage_path_backfill_snapshot");
    const rls = backfill.indexOf("alter table utero_academy.storage_path_backfill_snapshot enable row level security;");
    const revoke = backfill.indexOf("revoke all on utero_academy.storage_path_backfill_snapshot from anon, authenticated;");
    const insert = backfill.indexOf("'insert into utero_academy.storage_path_backfill_snapshot '");

    expect(create).toBeGreaterThan(-1);
    expect(rls).toBeGreaterThan(create);
    expect(revoke).toBeGreaterThan(rls);
    expect(insert).toBeGreaterThan(revoke);
  });
});
