import test from "node:test";
import assert from "node:assert/strict";
import { parseCoordinates, parseDataUrl, validDate } from "./input.mjs";
import { permitDates } from "./permit-dates.mjs";

test("attendance input rejects invalid coordinates and calendar dates", () => {
  assert.equal(parseCoordinates({ latitude: 91, longitude: 112 }), null);
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2026-02-28"), true);
});

test("attendance data URL validates canonical base64", () => {
  assert.deepEqual(parseDataUrl("data:image/png;base64,aGVsbG8="), { mimeType: "image/png", buffer: Buffer.from("hello") });
  assert.equal(parseDataUrl("data:image/png;base64,%%%"), null);
});

test("permit date expansion is inclusive and bounded", () => {
  assert.deepEqual(permitDates("2026-10-01", "2026-10-03"), ["2026-10-01", "2026-10-02", "2026-10-03"]);
  assert.equal(permitDates("2026-10-03", "2026-10-01"), null);
  assert.equal(permitDates("2026-01-01", "2027-01-02"), null);
});
