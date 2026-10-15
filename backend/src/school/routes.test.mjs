import assert from "node:assert/strict";
import test from "node:test";
import { parseApplication, parseReportRange } from "./input.mjs";
import { resolveSchool, validId } from "./access.mjs";

test("resolveSchool membatasi akun ke relasi school_contacts", async () => {
  const calls = [];
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    return { rowCount: 1, rows: [{ id: "school-1", name: "SMK Utero", partner_status: "active_partner" }] };
  } };
  const result = await resolveSchool(client, { id: "user-1" }, { active: true });
  assert.equal(result.school.id, "school-1");
  assert.match(calls[0].sql, /school_contacts/);
  assert.deepEqual(calls[0].values, ["user-1"]);
});

test("resolveSchool menolak partner nonaktif dan relasi ambigu", async () => {
  const inactive = { query: async () => ({ rowCount: 1, rows: [{ partner_status: "pending" }] }) };
  assert.equal((await resolveSchool(inactive, { id: "u" }, { active: true })).error, "school_partner_inactive");
  const ambiguous = { query: async () => ({ rowCount: 2, rows: [{}, {}] }) };
  assert.equal((await resolveSchool(ambiguous, { id: "u" })).error, "school_contact_required");
});

test("input aplikasi dan rentang laporan divalidasi ketat", () => {
  const valid = parseApplication({ fullName: "Budi Santoso", email: "BUDI@example.com", phone: "081234567890", studentNumber: "12345", major: "RPL", motivation: "Belajar", proposedStartDate: "2027-01-01", proposedEndDate: "2027-03-31" });
  assert.equal(valid.email, "budi@example.com");
  assert.equal(parseApplication({ ...valid, proposedEndDate: "2026-01-01" }), null);
  assert.deepEqual(parseReportRange({ from: "2027-01-01", to: "2027-01-31" }), { from: "2027-01-01", to: "2027-01-31" });
  assert.equal(parseReportRange({ from: "2027-01-01", to: "2028-02-01" }), null);
  assert.equal(validId("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(validId("not-an-id"), false);
});
