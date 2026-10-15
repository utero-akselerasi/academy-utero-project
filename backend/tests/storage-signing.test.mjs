import assert from "node:assert/strict";
import test from "node:test";
import { createStorageToken, verifyStorageToken } from "../src/storage/signing.mjs";

test("signed storage token binds path and expiry", () => {
  const now = Date.now();
  const token = createStorageToken("secret-very-long-for-test", "academy-private", "user/file.pdf", now + 1000);
  assert.equal(verifyStorageToken("secret-very-long-for-test", token, "academy-private", "user/file.pdf", now), true);
  assert.equal(verifyStorageToken("secret-very-long-for-test", token, "academy-private", "other.pdf", now), false);
  assert.equal(verifyStorageToken("secret-very-long-for-test", token, "academy-private", "user/file.pdf", now + 1001), false);
});
