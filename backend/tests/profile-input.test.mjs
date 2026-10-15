import assert from "node:assert/strict";
import test from "node:test";
import { parseGeneralProfile, parseInternProfile } from "../src/profiles/input.mjs";

test("general profile membersihkan nilai opsional", () => {
  assert.deepEqual(parseGeneralProfile({ fullName: " Budi ", phone: "", headline: " Dev ", bio: "" }), {
    fullName: "Budi", phone: null, headline: "Dev", bio: null, avatarPath: null,
  });
});

test("intern profile memvalidasi kontak", () => {
  const input = {
    fullName: "Budi", phone: "+62 812345678", major: "RPL", gradeOrSemester: "12",
    schoolName: "SMK", address: "Alamat", schoolSupervisorName: "Guru",
    schoolSupervisorPhone: "081234567890", emergencyContactName: "Orang Tua",
    emergencyContactPhone: "081234567891",
  };
  assert.equal(parseInternProfile(input)?.major, "RPL");
  assert.equal(parseInternProfile({ ...input, emergencyContactPhone: "" }), null);
});
