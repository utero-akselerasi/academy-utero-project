import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(new URL("../scripts/copy-database.sh", import.meta.url), "utf8");

test("copy database memakai satu exported snapshot untuk seluruh dataset sumber", () => {
  assert.match(script, /hold-source-snapshot\.mjs/);
  assert.equal((script.match(/set transaction snapshot :'source_snapshot';/g) || []).length, 3);
  assert.match(script, /pg_dump[\s\S]*--snapshot="\$source_snapshot"/);
  assert.match(script, /kill "\$snapshot_keeper_pid"[\s\S]*snapshot_keeper_pid=""/);
  assert.match(script, /trap cleanup EXIT/);
  assert.match(script, /trap 'exit 130' INT/);
  assert.match(script, /trap 'exit 143' TERM/);
  const sourceCopies = script.split("\n").filter((line) => line.startsWith("\\copy (select ") && line.includes("$workdir/"));
  assert.equal(sourceCopies.length, 3);
  assert.ok(sourceCopies.every((line) => /\) to '\$workdir\/.+\.csv' with \(format csv\)$/.test(line)));
});

test("copy database menolak source dan target PostgreSQL yang sama", () => {
  assert.match(script, /source_database_identity=.*psql "\$SOURCE_DATABASE_URL"/);
  assert.match(script, /target_database_identity=.*psql "\$TARGET_DATABASE_URL"/);
  assert.match(script, /if \[ "\$source_database_identity" = "\$target_database_identity" \]/);
});

test("trigger provisioning hanya nonaktif di dalam import target atomik", () => {
  const disable = script.indexOf("alter table auth.users disable trigger provision_utero_academy_applicant;");
  const authCopy = script.indexOf("\\\\copy auth.users(");
  const academyDump = script.indexOf('cat "$workdir/utero-academy.sql"');
  const enable = script.indexOf("alter table auth.users enable trigger provision_utero_academy_applicant;");
  const atomicImport = script.indexOf('--single-transaction --file="$workdir/import.sql"');

  assert.ok(disable >= 0 && disable < authCopy);
  assert.ok(authCopy < academyDump && academyDump < enable);
  assert.ok(enable < atomicImport);
});
