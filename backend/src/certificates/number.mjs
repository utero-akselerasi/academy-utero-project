import { randomInt } from "node:crypto";

export function certificateNumber(now = new Date()) {
  return `CERT/UA/${now.getUTCFullYear()}/${randomInt(100000, 1000000)}`;
}
