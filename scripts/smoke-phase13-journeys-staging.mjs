#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const routes = ["/register", "/login"];

export function validateStaging(env) {
  const value = env.PHASE13_STAGING_APP_URL;
  let url;
  try { url = new URL(value); } catch { throw new Error("URL app staging tidak valid"); }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      ["3000", "18100", "15532"].includes(url.port)) throw new Error("App wajib loopback staging pada port terpisah dari develop dan Supabase");
  const sample = env.PHASE13_SOUNDPUB_AVATAR_PATH;
  if (sample && (!/^[a-zA-Z0-9_./-]+$/.test(sample) || sample.split("/").some((part) => !part || part === "." || part === ".."))) {
    throw new Error("Path sampel SoundPub tidak aman");
  }
  return { base: url.origin, sample };
}

export async function smokeJourneys(env = process.env, fetcher = fetch) {
  const { base, sample } = validateStaging(env);
  const result = {};
  for (const route of routes) {
    try {
      const response = await fetcher(`${base}${route}`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10000) });
      result[route] = response.status === 200 ? "passed" : "failed";
      await response.body?.cancel();
    } catch { result[route] = "failed"; }
  }
  result.soundpubAvatar = "untested";
  if (sample && env.SUPABASE_STAGING_URL === "http://127.0.0.1:18100") {
    const object = sample.split("/").map(encodeURIComponent).join("/");
    try {
      const response = await fetcher(`http://127.0.0.1:18100/storage/v1/object/public/avatars/${object}`, {
        method: "GET", redirect: "manual", signal: AbortSignal.timeout(10000),
      });
      result.soundpubAvatar = response.status === 200 && response.headers.get("content-type")?.startsWith("image/") ? "passed" : "failed";
      await response.body?.cancel();
    } catch { result.soundpubAvatar = "failed"; }
  }
  return result;
}

export function smokeComplete(result) {
  return Object.values(result).length === 3 &&
    ["/register", "/login", "soundpubAvatar"].every((key) => result[key] === "passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  smokeJourneys().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!smokeComplete(result)) process.exitCode = 1;
  }).catch(() => {
    process.stderr.write("Smoke staging gagal: periksa URL loopback dan konfigurasi staging.\n");
    process.exitCode = 1;
  });
}
