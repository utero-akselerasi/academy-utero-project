import { createHmac, timingSafeEqual } from "node:crypto";

function signature(secret, value) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createStorageToken(secret, bucket, objectPath, expiresAt) {
  const payload = Buffer.from(JSON.stringify({ bucket, objectPath, expiresAt }), "utf8").toString("base64url");
  return `${payload}.${signature(secret, payload)}`;
}

export function verifyStorageToken(secret, token, bucket, objectPath, now = Date.now()) {
  if (typeof token !== "string" || token.length > 2048) return false;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return false;
  const expected = signature(secret, payload);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.bucket === bucket && parsed.objectPath === objectPath && Number.isSafeInteger(parsed.expiresAt) && parsed.expiresAt >= now;
  } catch {
    return false;
  }
}
