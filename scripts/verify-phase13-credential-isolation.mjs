#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const CREDENTIAL_ENV_NAMES = Object.freeze([
  "PHASE13_DEV_JWT_SECRET",
  "PHASE13_PROD_JWT_SECRET",
  "PHASE13_DEV_SUPABASE_SERVICE_ROLE_KEY",
  "PHASE13_PROD_SUPABASE_SERVICE_ROLE_KEY",
  "PHASE13_DEV_SUPABASE_ANON_KEY",
  "PHASE13_PROD_SUPABASE_ANON_KEY",
]);

const CREDENTIAL_PAIRS = Object.freeze([
  ["PHASE13_DEV_JWT_SECRET", "PHASE13_PROD_JWT_SECRET"],
  ["PHASE13_DEV_SUPABASE_SERVICE_ROLE_KEY", "PHASE13_PROD_SUPABASE_SERVICE_ROLE_KEY"],
  ["PHASE13_DEV_SUPABASE_ANON_KEY", "PHASE13_PROD_SUPABASE_ANON_KEY"],
]);

export function verifyCredentialIsolation(env = process.env) {
  for (const name of CREDENTIAL_ENV_NAMES) {
    if (typeof env[name] !== "string" || env[name].length === 0) return false;
  }

  return CREDENTIAL_PAIRS.every(([devName, prodName]) => env[devName] !== env[prodName]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (verifyCredentialIsolation()) {
    process.stdout.write("GO\n");
  } else {
    process.stderr.write("NO-GO\n");
    process.exitCode = 1;
  }
}
