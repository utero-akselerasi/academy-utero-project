import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const targets = { develop: "supabase.carubra.com", production: "supabase.carubra.space", staging: "127.0.0.1" };
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_APP_URL"];

export function parseBuildEnv(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || !required.includes(match[1]) || Object.hasOwn(values, match[1])) throw new Error("Format env build tidak valid, key tidak diizinkan, atau duplikat");
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function verifyTarget(target, values, { build = true } = {}) {
  if (!Object.hasOwn(targets, target)) throw new Error("DEPLOY_TARGET wajib develop, production, atau staging");
  for (const key of required) {
    if (!values[key] || !values[key].trim()) throw new Error(`${key} wajib diisi`);
  }
  if (build && (values.SUPABASE_SERVICE_ROLE_KEY || values.DATABASE_URL)) {
    throw new Error("Env build tidak boleh memuat kredensial server atau database");
  }
  let url;
  let appUrl;
  try {
    url = new URL(values.NEXT_PUBLIC_SUPABASE_URL);
    appUrl = new URL(values.NEXT_PUBLIC_APP_URL);
  } catch {
    throw new Error("URL build tidak valid");
  }
  if (target === "staging" ? url.href !== "http://127.0.0.1:18100/" : url.protocol !== "https:" || url.hostname !== targets[target] || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`URL Supabase tidak cocok dengan target ${target}`);
  }
  const remoteApp = appUrl.protocol === "https:" && !!appUrl.hostname && !appUrl.port &&
    !appUrl.username && !appUrl.password && appUrl.pathname === "/" && !appUrl.search && !appUrl.hash;
  const loopbackApp = appUrl.protocol === "http:" && appUrl.hostname === "127.0.0.1" && urlPortIsNonprivileged(appUrl) &&
    !appUrl.username && !appUrl.password && appUrl.pathname === "/" && !appUrl.search && !appUrl.hash;
  if (target === "staging" ? !loopbackApp : target === "develop" ? !(remoteApp || loopbackApp) : !remoteApp) {
    throw new Error("NEXT_PUBLIC_APP_URL wajib URL HTTPS tanpa kredensial");
  }
  return {
    target,
    supabaseUrl: url.origin,
    appUrl: appUrl.origin,
    anonKeyDigest: createHash("sha256").update(values.NEXT_PUBLIC_SUPABASE_ANON_KEY).digest("hex"),
  };
}

function urlPortIsNonprivileged(url) {
  const port = Number(url.port);
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

function main() {
  const [mode, targetOrFile, secretFile] = process.argv.slice(2);
  if (mode === "build") {
    const values = parseBuildEnv(readFileSync(secretFile, "utf8"));
    const marker = verifyTarget(targetOrFile, values);
    writeFileSync(".supabase-build-target.json", JSON.stringify(marker));
    const env = { ...process.env, ...values, SUPABASE_SERVICE_ROLE_KEY: "build-only-placeholder" };
    delete env.DATABASE_URL;
    const result = spawnSync("npm", ["run", "build"], { env, stdio: "inherit", shell: process.platform === "win32" });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else if (mode === "start") {
    const marker = JSON.parse(readFileSync(targetOrFile, "utf8"));
    const runtime = verifyTarget(marker.target, process.env, { build: false });
    if (JSON.stringify(runtime) !== JSON.stringify(marker)) throw new Error("Konfigurasi runtime berbeda dari build");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw new Error("SUPABASE_SERVICE_ROLE_KEY runtime wajib diisi");
    const result = spawnSync("npm", ["start"], { stdio: "inherit", shell: process.platform === "win32" });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else {
    throw new Error("Mode verifikasi tidak dikenal");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`Verifikasi target gagal: ${error.message}`);
    process.exitCode = 1;
  }
}
