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

test("nomor Indonesia diterima untuk 08/628 dan disimpan dalam bentuk 628", () => {
  const input = {
    fullName: "Budi", phone: "0812-3456-7890", major: "RPL", gradeOrSemester: "12",
    schoolName: "SMK", address: "Alamat", schoolSupervisorName: "Guru",
    schoolSupervisorPhone: "+62 812-3456-7891", emergencyContactName: "", emergencyContactPhone: "",
  };
  const result = parseInternProfile(input);
  assert.equal(result.phone, "6281234567890");
  assert.equal(result.schoolSupervisorPhone, "6281234567891");
});

test("menolak nomor yang hanya dimulai dengan 620", () => {
  const input = {
    fullName: "Budi", phone: "620817270898", major: "RPL", gradeOrSemester: "12",
    schoolName: "SMK", address: "Alamat", schoolSupervisorName: "Guru",
    schoolSupervisorPhone: "081234567890", emergencyContactName: "", emergencyContactPhone: "",
  };
  assert.equal(parseInternProfile(input), null);
  assert.equal(parseInternProfile({ ...input, phone: "081234567890", schoolSupervisorPhone: "620817270898" }), null);
});
