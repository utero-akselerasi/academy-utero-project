#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourceRoot = "/data/supabase/instances/supabase-02";
const productionRoot = "/data/supabase/instances/supabase-01";
const allowedRoots = ["/data/supabase/instances", "/home/maskhar/supabase-replacements"];

export function validateReplacementManifest(manifest) {
  if (manifest?.sourceInstance !== "supabase-02" ||
      typeof manifest.project !== "string" || !/^supabase-02-rollback-[a-z0-9-]+$/.test(manifest.project) ||
      manifest.gatewayPort !== 8200 || manifest.databasePort !== 5632 ||
      !Array.isArray(manifest.mounts) || manifest.mounts.length < 2 ||
      !Array.isArray(manifest.containers) || !manifest.containers.length ||
      manifest.containers.some((name) => typeof name !== "string" || !name.startsWith(`${manifest.project}-`)) ||
      !Array.isArray(manifest.images) || !manifest.images.length ||
      manifest.images.some((digest) => !/^sha256:[a-f0-9]{64}$/.test(digest))) {
    throw new Error("Identitas replacement tidak lengkap atau port/nama berbenturan");
  }
  const root = path.posix.resolve(manifest.root ?? "");
  const parent = path.posix.dirname(root);
  if (!allowedRoots.includes(parent) || root !== `${parent}/${manifest.project}` || manifest.mounts.some((mount) =>
    typeof mount !== "string" || !path.posix.isAbsolute(mount) ||
    !path.posix.resolve(mount).startsWith(`${root}/`) ||
    path.posix.resolve(mount).startsWith(`${sourceRoot}/`) ||
    path.posix.resolve(mount).startsWith(`${productionRoot}/`))) {
    throw new Error("Volume replacement wajib terpisah dari source dan production");
  }
  if (new Set(manifest.mounts).size !== manifest.mounts.length ||
      new Set(manifest.containers).size !== manifest.containers.length) {
    throw new Error("Identitas replacement duplikat");
  }
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

async function main() {
  if (process.argv.length !== 3) throw new Error("Gunakan: node scripts/preflight-phase13-rollback-replacement.mjs manifest.json");
  const file = process.argv[2];
  if (!(await lstat(file)).isFile()) throw new Error("Manifest wajib file reguler");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  const digest = validateReplacementManifest(manifest);
  if (await realpath(manifest.root) !== manifest.root) throw new Error("Root replacement tidak kanonis");
  for (const mount of manifest.mounts) {
    if (await realpath(mount) !== mount) throw new Error("Mount replacement tidak kanonis");
  }
  console.log(JSON.stringify({ target: "staging-replacement", identitySha256: digest,
    note: "Manifest saja tidak membuktikan Docker mounts/port live; cocokkan docker inspect dan ss sebelum restore" }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Replacement NO-GO: ${error.message}`); process.exitCode = 1; });
}
