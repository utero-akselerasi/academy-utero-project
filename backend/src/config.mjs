import path from "node:path";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi`);
  return value;
}

function positiveInteger(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} harus bilangan positif`);
  return value;
}

export function loadConfig() {
  return {
    databaseUrl: required("DATABASE_URL"),
    host: process.env.API_HOST?.trim() || "0.0.0.0",
    port: positiveInteger("API_PORT", 3001),
    sessionCookie: process.env.SESSION_COOKIE_NAME?.trim() || "utero_session",
    sessionTtlSeconds: positiveInteger("SESSION_TTL_SECONDS", 60 * 60 * 24 * 7),
    storageRoot: path.resolve(process.env.STORAGE_ROOT?.trim() || "/srv/storage"),
    storageSigningSecret: required("STORAGE_SIGNING_SECRET"),
    trustProxy: process.env.TRUST_PROXY === "true",
    secureCookies: process.env.SECURE_COOKIES !== "false",
    publicAppUrl: process.env.PUBLIC_APP_URL?.trim(),
    smtp: {
      host: process.env.SMTP_HOST?.trim(),
      port: positiveInteger("SMTP_PORT", 587),
      user: process.env.SMTP_USER?.trim(),
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM?.trim(),
    },
  };
}
