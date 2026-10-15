import assert from "node:assert/strict";
import test from "node:test";
import { verifyContentType } from "../src/storage/content.mjs";

test("reject spoofed PDF metadata", async () => {
  assert.equal(await verifyContentType(Buffer.from("not a pdf"), "application/pdf"), false);
  assert.equal(await verifyContentType(Buffer.from("%PDF-1.7\n123"), "application/pdf"), true);
});
