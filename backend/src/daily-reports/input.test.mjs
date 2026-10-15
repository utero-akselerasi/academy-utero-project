import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedDriveLink, parseReport } from "./input.mjs";

test("daily report accepts only trusted Drive hosts", () => {
  assert.equal(isAllowedDriveLink("https://drive.google.com/file/d/abc"), true);
  assert.equal(isAllowedDriveLink("https://drive.google.com.evil.test/file"), false);
  assert.equal(isAllowedDriveLink("javascript:alert(1)"), false);
});

test("daily report validates date, content, attachment count, and edit id", () => {
  assert.equal(parseReport({ reportDate: "2026-02-30", todayWork: "cukup panjang" }), null);
  assert.equal(parseReport({ reportDate: "2026-10-14", todayWork: "pendek" }), null);
  const parsed = parseReport({ reportDate: "2026-10-14", todayWork: "Menyelesaikan integrasi backend lokal." });
  assert.equal(parsed?.reportDate, "2026-10-14");
  assert.equal(parsed?.attachments.length, 0);
});
