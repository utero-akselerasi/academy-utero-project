import { createHash, randomBytes } from "node:crypto";

export function sessionDigest(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db, userId, ttlSeconds, metadata = {}) {
  const token = randomBytes(32).toString("base64url");
  const digest = sessionDigest(token);
  await db.query(
    `insert into auth.sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     values ($1, $2, now() + make_interval(secs => $3), $4, $5)`,
    [userId, digest, ttlSeconds, metadata.ipAddress || null, metadata.userAgent || null],
  );
  return token;
}

export async function revokeSession(db, token) {
  if (!token) return;
  await db.query("update auth.sessions set revoked_at = now() where token_hash = $1 and revoked_at is null", [sessionDigest(token)]);
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const value of header.split(";")) {
    const separator = value.indexOf("=");
    if (separator < 0) continue;
    if (value.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(value.slice(separator + 1).trim()); }
      catch { return null; }
    }
  }
  return null;
}

export function sessionCookie(name, token, maxAge, secure) {
  const parts = [`${name}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function expiredSessionCookie(name, secure) {
  return sessionCookie(name, "", 0, secure);
}
