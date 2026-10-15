import { readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED = Object.freeze([
  "ACADEMY_POSTGRES_PASSWORD",
  "ACADEMY_API_PASSWORD",
  "ACADEMY_STORAGE_SIGNING_SECRET",
  "ACADEMY_MIGRATION_DATABASE_URL",
  "ACADEMY_API_DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "PUBLIC_APP_URL",
  "ACADEMY_SECURE_COOKIES",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "ACADEMY_TLS_CERT_DIR",
]);

const PLACEHOLDER = /(?:<[A-Za-z][A-Za-z0-9_-]*>|\$\{[^}]+\}|change[-_ ]?me|replace[-_ ]?me|local-full-test|fixture|example\.(?:com|net|org|test)|\.example(?:[/:]|$)|\/absolute\/path|password-kuat-123)/i;
const CHECKS = Object.freeze([
  "required-values",
  "no-placeholders-or-fixtures",
  "canonical-https-origin",
  "secure-cookie-overrides",
  "postgres-target-isolation",
  "smtp",
  "signing-secret",
  "tls-files",
  "optional-cutover-inputs",
]);

function fail(message) {
  throw new Error(message);
}

export function parseEnvFile(content) {
  const values = {};
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) fail(`Format env tidak valid pada baris ${index + 1}`);
    const [, key, rawValue] = match;
    if (Object.hasOwn(values, key)) fail(`Variabel env duplikat: ${key}`);

    let value = rawValue;
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      if (value.length < 2 || !value.endsWith(quote)) fail(`Kutipan env tidak valid: ${key}`);
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    values[key] = value;
  }
  return values;
}

function requiredValue(env, key) {
  const value = env[key]?.trim();
  if (!value) fail(`Variabel wajib kosong: ${key}`);
  return value;
}

function rejectUnsafeValues(env) {
  for (const [key, value] of Object.entries(env)) {
    if (value && PLACEHOLDER.test(value)) fail(`Placeholder atau fixture ditolak: ${key}`);
  }
}

function canonicalHttpsOrigin(value, key) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`URL tidak valid: ${key}`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.pathname !== "/" || value !== url.origin || !url.hostname.includes(".") ||
      url.hostname === "localhost") fail(`URL wajib origin HTTPS kanonis tanpa trailing slash: ${key}`);
  return url.origin;
}

function postgresTarget(value, key) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`URL PostgreSQL tidak valid: ${key}`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username ||
      !url.password || !url.pathname || url.pathname === "/" || url.search || url.hash) {
    fail(`URL PostgreSQL tidak lengkap: ${key}`);
  }
  return {
    url,
    identity: `${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`,
  };
}

function validateSmtp(env) {
  const host = requiredValue(env, "SMTP_HOST");
  if (/[:/\s]/.test(host) || host.startsWith(".") || host.endsWith(".")) fail("SMTP_HOST tidak valid");
  const port = Number(requiredValue(env, "SMTP_PORT"));
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) fail("SMTP_PORT tidak valid");
  requiredValue(env, "SMTP_USER");
  requiredValue(env, "SMTP_PASSWORD");
  const from = requiredValue(env, "SMTP_FROM");
  if (!/^(?:[^<>\r\n]+\s*)?<[^<>\s@]+@[^<>\s@]+>|^[^<>\s@]+@[^<>\s@]+$/.test(from)) {
    fail("SMTP_FROM wajib alamat email atau Name <email>");
  }
}

export function validateComposeCookieOverrides(composeText) {
  const web = /web:[\s\S]*?ACADEMY_SECURE_COOKIES:\s*["']true["']/m.test(composeText);
  const api = /api:[\s\S]*?SECURE_COOKIES:\s*["']true["']/m.test(composeText);
  if (!web || !api) fail("Compose production wajib memaksa secure cookies untuk web dan API");
  return true;
}

async function requireExistingFile(path, label) {
  try {
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size === 0) fail(`File TLS tidak valid: ${label}`);
  } catch (error) {
    if (error?.message?.startsWith("File TLS")) throw error;
    fail(`File TLS tidak ditemukan: ${label}`);
  }
}

async function validateFilesystem(env) {
  const tlsDirectory = requiredValue(env, "ACADEMY_TLS_CERT_DIR");
  if (!isAbsolute(tlsDirectory)) fail("ACADEMY_TLS_CERT_DIR wajib path absolut");
  await Promise.all([
    requireExistingFile(resolve(tlsDirectory, "fullchain.pem"), "fullchain.pem"),
    requireExistingFile(resolve(tlsDirectory, "privkey.pem"), "privkey.pem"),
  ]);

  const storageSource = env.STORAGE_IMPORT_SOURCE?.trim();
  if (storageSource) {
    if (!isAbsolute(storageSource)) fail("STORAGE_IMPORT_SOURCE wajib path absolut bila diisi");
    try {
      if (!(await stat(storageSource)).isDirectory()) fail("STORAGE_IMPORT_SOURCE bukan direktori");
    } catch (error) {
      if (error?.message === "STORAGE_IMPORT_SOURCE bukan direktori") throw error;
      fail("STORAGE_IMPORT_SOURCE tidak ditemukan");
    }
  }
}

export async function validateSelfhostedProductionEnv(env, options = {}) {
  for (const key of REQUIRED) requiredValue(env, key);
  rejectUnsafeValues(env);

  const publicOrigin = canonicalHttpsOrigin(env.PUBLIC_APP_URL, "PUBLIC_APP_URL");
  const nextOrigin = canonicalHttpsOrigin(env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL");
  if (publicOrigin !== nextOrigin) fail("PUBLIC_APP_URL dan NEXT_PUBLIC_APP_URL wajib origin yang sama");
  if (env.ACADEMY_SECURE_COOKIES !== "true") fail("ACADEMY_SECURE_COOKIES wajib true");

  const migration = postgresTarget(env.ACADEMY_MIGRATION_DATABASE_URL, "ACADEMY_MIGRATION_DATABASE_URL");
  const api = postgresTarget(env.ACADEMY_API_DATABASE_URL, "ACADEMY_API_DATABASE_URL");
  if (migration.identity !== api.identity) fail("URL database migrasi dan API wajib menunjuk target yang sama");
  if (migration.url.username !== "postgres" || api.url.username !== "academy_api") {
    fail("User database target wajib postgres untuk migrasi dan academy_api untuk API");
  }
  if (decodeURIComponent(migration.url.password) !== env.ACADEMY_POSTGRES_PASSWORD ||
      decodeURIComponent(api.url.password) !== env.ACADEMY_API_PASSWORD) {
    fail("Password URL database tidak cocok dengan variabel password target");
  }

  const sourceValue = env.SOURCE_DATABASE_URL?.trim();
  if (sourceValue) {
    const source = postgresTarget(sourceValue, "SOURCE_DATABASE_URL");
    if (source.identity === migration.identity) fail("Database sumber dan target wajib berbeda");
  }

  validateSmtp(env);
  if (Buffer.byteLength(env.ACADEMY_STORAGE_SIGNING_SECRET, "utf8") < 32) {
    fail("ACADEMY_STORAGE_SIGNING_SECRET minimal 32 byte");
  }
  if (new Set([env.ACADEMY_POSTGRES_PASSWORD, env.ACADEMY_API_PASSWORD,
    env.ACADEMY_STORAGE_SIGNING_SECRET, env.SMTP_PASSWORD]).size !== 4) {
    fail("Secret production wajib berbeda satu sama lain");
  }

  await validateFilesystem(env);
  validateComposeCookieOverrides(options.composeText ?? await readFile(
    new URL("../docker-compose.production.yml", import.meta.url), "utf8"));
  return { ready: true, checks: [...CHECKS] };
}

export function parseCliArgs(args) {
  if (args.length !== 2 || args[0] !== "--env-file" || !isAbsolute(args[1])) {
    fail("Gunakan: node scripts/validate-selfhosted-production-env.mjs --env-file <path-absolut>");
  }
  return { envFile: args[1] };
}

async function main() {
  try {
    const { envFile } = parseCliArgs(process.argv.slice(2));
    const metadata = await stat(envFile);
    if (!metadata.isFile()) fail("--env-file wajib berkas reguler");
    const report = await validateSelfhostedProductionEnv(parseEnvFile(await readFile(envFile, "utf8")));
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error(JSON.stringify({ ready: false, error: error instanceof Error ? error.message : "Validasi gagal" }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
