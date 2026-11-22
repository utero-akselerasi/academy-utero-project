import assert from "node:assert/strict";
import test from "node:test";
import { parseRegistration, validId } from "../src/registration/input.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const programId = "22222222-2222-4222-8222-222222222222";
const schoolLetterPath = `${userId}/applications/school-letter/33333333-3333-4333-8333-333333333333.pdf`;
const photoPath = `${userId}/applications/photo/33333333-3333-4333-8333-333333333333.jpg`;

test("registration input dinormalisasi", () => {
  assert.deepEqual(parseRegistration({
    programId, fullName: "  Budi Santoso ", phone: " 6281234567890 ", schoolName: " SMK Utero ",
    major: " RPL ", motivation: " Saya ingin belajar pengembangan aplikasi. ", studentNumber: " 123 ",
    referralCode: " PARTNER ", proposedStartDate: "2026-11-01", proposedEndDate: "2027-01-01",
    cvPath: `${userId}/applications/cv/33333333-3333-4333-8333-333333333333.pdf`, portfolioPath: null, schoolLetterPath, proposalPath: null, photoPath,
  }), {
    programId, fullName: "Budi Santoso", phone: "6281234567890", schoolName: "SMK Utero", major: "RPL",
    motivation: "Saya ingin belajar pengembangan aplikasi.", studentNumber: "123", referralCode: "PARTNER",
    proposedStartDate: "2026-11-01", proposedEndDate: "2027-01-01",
    cvPath: `${userId}/applications/cv/33333333-3333-4333-8333-333333333333.pdf`, portfolioPath: null, schoolLetterPath, proposalPath: null, photoPath,
  });
});

test("registration input menolak UUID, tanggal, dan jalur tidak valid", () => {
  assert.equal(validId(programId), true);
  assert.equal(validId("bukan-uuid"), false);
  const base = { programId, fullName: "Budi Santoso", phone: "6281234567890", schoolName: "SMK Utero", major: "RPL", motivation: "Motivasi valid untuk mendaftar magang.", studentNumber: "", referralCode: "", proposedStartDate: "2026-11-02", proposedEndDate: "2026-11-01", cvPath: `${userId}/applications/cv/33333333-3333-4333-8333-333333333333.pdf`, portfolioPath: null, schoolLetterPath, proposalPath: null, photoPath };
  assert.equal(parseRegistration(base), null);
  const validDates = { ...base, proposedEndDate: "2026-12-01" };
  for (const invalid of [{ photoPath: null }, { photoPath: photoPath.replace(".jpg", ".pdf") }, { schoolLetterPath: null }, { schoolLetterPath: schoolLetterPath.replace("school-letter", "cv") }]) {
    assert.equal(parseRegistration({ ...validDates, ...invalid }), null);
  }
  for (const phone of ["081234567890", "-8988270898", "+6281234567890", "62abc12345678"]) {
    assert.equal(parseRegistration({ ...validDates, phone }), null);
  }
  assert.equal(parseRegistration({ ...base, proposedEndDate: "2026-12-01", cvPath: `${userId}/applications/portfolio/33333333-3333-4333-8333-333333333333.pdf` }), null);
});
