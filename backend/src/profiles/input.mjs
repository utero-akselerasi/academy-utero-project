const PHONE_PATTERN = /^628[1-9]\d{7,10}$/;

function phone(value) {
  if (typeof value !== "string" || !/^(?:\+?62|0)[0-9\s()-]*$/.test(value.trim())) return undefined;
  const normalized = value.replace(/[\s()+-]/g, "");
  const canonical = normalized.startsWith("08") ? `62${normalized.slice(1)}` : normalized;
  return PHONE_PATTERN.test(canonical) ? canonical : undefined;
}

function text(value, maximum, required = false) {
  const normalized = String(value ?? "").trim();
  if ((required && !normalized) || normalized.length > maximum) return undefined;
  return normalized || null;
}

export function parseGeneralProfile(body) {
  const fullName = text(body?.fullName, 150, true);
  const phoneValue = text(body?.phone, 25);
  if (fullName === undefined || phoneValue === undefined) return null;
  const phoneNumber = phoneValue ? phone(phoneValue) : null;
  if (phoneNumber === undefined) return null;
  return { fullName, phone: phoneNumber, avatarPath: text(body?.avatarPath, 500) };
}

export function parseInternProfile(body) {
  const rawProfile = {
    fullName: text(body?.fullName, 150, true),
    phone: text(body?.phone, 25, true),
    major: text(body?.major, 120, true),
    gradeOrSemester: text(body?.gradeOrSemester, 60, true),
    schoolName: text(body?.schoolName, 150, true),
    address: text(body?.address, 500, true),
    schoolSupervisorName: text(body?.schoolSupervisorName, 150, true),
    schoolSupervisorPhone: text(body?.schoolSupervisorPhone, 25, true),
    emergencyContactName: text(body?.emergencyContactName, 150),
    emergencyContactPhone: text(body?.emergencyContactPhone, 25),
    avatarPath: text(body?.avatarPath, 500),
  };
  if (Object.values(rawProfile).some((value) => value === undefined)) return null;
  const phoneNumber = phone(rawProfile.phone);
  const schoolSupervisorPhone = phone(rawProfile.schoolSupervisorPhone);
  const emergencyContactPhone = rawProfile.emergencyContactPhone ? phone(rawProfile.emergencyContactPhone) : null;
  if (!phoneNumber || !schoolSupervisorPhone || (rawProfile.emergencyContactPhone && !emergencyContactPhone)) return null;
  if (Boolean(rawProfile.emergencyContactName) !== Boolean(rawProfile.emergencyContactPhone)) return null;
  return { ...rawProfile, phone: phoneNumber, schoolSupervisorPhone, emergencyContactPhone };
}
