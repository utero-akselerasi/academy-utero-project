import assert from "node:assert/strict";
import test from "node:test";
import { normalizeObjectPath, resolveObjectFile } from "../src/storage/path.mjs";

test("object path menerima path relatif aman", () => {
  assert.equal(normalizeObjectPath("user/file.pdf"), "user/file.pdf");
});

test("object path menolak traversal", () => {
  for (const value of ["../file", "/root/file", "folder/../file", "folder\\..\\file", "folder/"]) {
    assert.throws(() => normalizeObjectPath(value));
  }
});

test("resolved object tetap dalam storage root", () => {
  const result = resolveObjectFile("/srv/storage", "academy-private", "user/file.pdf");
  assert.match(result.target.replaceAll("\\", "/"), /\/srv\/storage\/academy-private\/user\/file\.pdf$/);
});

test("reject invalid bucket", () => {
  assert.throws(() => resolveObjectFile("/srv/storage", "../secret", "user/file.pdf"));
});
