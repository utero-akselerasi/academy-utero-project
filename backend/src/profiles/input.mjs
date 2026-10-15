const PHONE_PATTERN = /^\+?[0-9][0-9\s()-]{7,24}$/;

function text(value, maximum, required = false) {
  const normalized = String(value ?? "").trim();
  if ((required && !normalized) || normalized.length > maximum) return undefined;
  return normalized || null;
}

export function parseGeneralProfile(body) {
  const fullName = text(body?.fullName, 150, true);
  const phone = text(body?.phone, 25);
  const headline = text(body?.headline, 150);
  const bio = text(body?.bio, 2000);
  if (fullName === undefined || phone === undefined || headline === undefined || bio === undefined) return null;
  return { fullName, phone, headline, bio, avatarPath: text(body?.avatarPath, 500) };
}

export function parseInternProfile(body) {
  const profile = {
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
  if (Object.values(profile).some((value) => value === undefined)) return null;
  if (!PHONE_PATTERN.test(profile.phone) || !PHONE_PATTERN.test(profile.schoolSupervisorPhone)) return null;
  if (Boolean(profile.emergencyContactName) !== Boolean(profile.emergencyContactPhone)) return null;
  if (profile.emergencyContactPhone && !PHONE_PATTERN.test(profile.emergencyContactPhone)) return null;
  return profile;
}
