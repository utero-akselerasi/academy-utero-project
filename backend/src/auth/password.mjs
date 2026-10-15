import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  if (encoded.startsWith("$2")) return bcrypt.compare(password, encoded);
  const [scheme, cost, blockSize, parallelization, saltValue, expectedValue] = encoded.split("$");
  if (scheme !== "scrypt" || !expectedValue) return false;
  const expected = Buffer.from(expectedValue, "base64url");
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
  }));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function needsPasswordRehash(encoded) {
  return !encoded.startsWith("scrypt$16384$8$1$");
}
