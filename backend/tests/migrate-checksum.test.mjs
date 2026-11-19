import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { migrationChecksum, migrationChecksumCandidates } from "../scripts/migrate.mjs";

test("existing migrations accept raw, LF, CRLF, and LF with final newline CRLF checksums", () => {
  const lf = "-- migration\nselect 1;\n";
  const crlf = lf.replace(/\n/g, "\r\n");
  const mixed = "-- migration\rselect 1;\r\n";
  const finalNewlineCrLf = `${lf.slice(0, -1)}\r\n`;

  for (const sql of [lf, crlf, mixed, finalNewlineCrLf]) {
    const candidates = migrationChecksumCandidates(sql);
    assert.equal(candidates.has(migrationChecksum(sql)), true);
    assert.equal(candidates.has(migrationChecksum(lf)), true);
    assert.equal(candidates.has(migrationChecksum(crlf)), true);
    assert.equal(candidates.has(migrationChecksum(finalNewlineCrLf)), true);
  }
  assert.equal(migrationChecksum(lf), createHash("sha256").update(lf, "utf8").digest("hex"));
  assert.notEqual(migrationChecksum(crlf), migrationChecksum(lf));
});

test("unrelated content and BOM changes remain mismatches", () => {
  const candidates = migrationChecksumCandidates("select 1;\n");
  assert.equal(candidates.has(migrationChecksum("select 2;\n")), false);
  assert.equal(candidates.has(migrationChecksum("\ufeffselect 1;\n")), false);
  assert.equal(candidates.has(migrationChecksum("select 1;\r\nextra")), false);
});

test("existing migrations accept LF content with entire trailing newline run as CRLF", () => {
  const lf = "-- migration\nselect 1;\n\n";
  const trailingCrLf = "-- migration\nselect 1;\r\n\r\n";
  const candidates = migrationChecksumCandidates(lf);

  assert.equal(candidates.has(migrationChecksum(trailingCrLf)), true);
  assert.equal(candidates.has(migrationChecksum("\ufeff" + trailingCrLf)), false);
  assert.equal(candidates.has(migrationChecksum("-- migration\nselect 2;\r\n\r\n")), false);
});
