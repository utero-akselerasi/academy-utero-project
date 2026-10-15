const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

export function parseSignup(body) {
  const fullName = String(body?.fullName || "").trim().replace(/\s+/g, " ");
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (fullName.length < 3 || fullName.length > 150) return { error: "invalid_full_name" };
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) return { error: "invalid_email" };
  if (password.length < 12 || password.length > 128) return { error: "invalid_password" };
  return { value: { fullName, email, password } };
}

export function parseVerificationToken(body) {
  const token = String(body?.token || "").trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: "invalid_verification_token" };
  return { value: token };
}

export function parseResendEmail(body) {
  const email = String(body?.email || "").trim().toLowerCase();
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) return { error: "invalid_email" };
  return { value: email };
}
