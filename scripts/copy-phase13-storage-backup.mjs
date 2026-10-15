#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rename } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const EXPECTED_COUNT = 417;
const usage = "Copy Phase 13 avatars dari backup lokal terverifikasi (dry-run default).\\n" +
  "Wajib: --allowlist --backup-root --manifest --database-url-env --target-url-env --target-key-env --state [--apply true]";

function parsePairs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length % 2) throw new Error("Argumen wajib pasangan --nama nilai");
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!args[index]?.startsWith("--") || !args[index + 1] || Object.hasOwn(result, args[index])) throw new Error("Argumen tidak valid");
    result[args[index]] = args[index + 1];
  }
  return result;
}

function assertPrivateAbsolute(file, label) {
  if (!file || !path.isAbsolute(file)) throw new Error(label + " wajib path absolut");
  const repository = path.resolve(import.meta.dirname, "..");
  const relative = path.relative(repository, path.resolve(file));
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) throw new Error(label + " wajib di luar repository");
}

function parseEnvName(value) {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(value ?? "")) throw new Error("Nama environment variable tidak valid");
  return value;
}

export function parseOptions(args) {
  const raw = parsePairs(args);
  if (raw.help) return raw;
  const allowed = new Set(["--allowlist", "--backup-root", "--manifest", "--database-url-env",
    "--target-url-env", "--target-key-env", "--state", "--apply", "--max-bytes"]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) throw new Error("Argumen tidak dikenal");
  const apply = raw["--apply"] === "true";
  if (raw["--apply"] && !apply) throw new Error("Gunakan --apply true");
  const options = {
    apply,
    allowlist: raw["--allowlist"],
    backupRoot: raw["--backup-root"],
    manifest: raw["--manifest"],
    state: raw["--state"],
    databaseUrlEnv: parseEnvName(raw["--database-url-env"]),
    targetUrlEnv: parseEnvName(raw["--target-url-env"]),
    targetKeyEnv: parseEnvName(raw["--target-key-env"]),
    maxBytes: Number(raw["--max-bytes"] ?? 20 * 1024 * 1024),
  };
  for (const item of [[options.allowlist, "Allowlist"], [options.backupRoot, "Backup root"],
    [options.manifest, "Manifest"], [options.state, "State"]]) assertPrivateAbsolute(item[0], item[1]);
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1) throw new Error("Max bytes tidak valid");
  return options;
}

function validateObjectPath(name) {
  if (!name || name.startsWith("/") || name.endsWith("/") || name.includes("\0") || name.includes("\\") ||
      name.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Allowlist memuat object path tidak aman");
  }
}

async function assertRegularFile(file, label) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(label + " wajib file reguler non-symlink");
}

async function readAllowlist(file) {
  await assertRegularFile(file, "Allowlist");
  const lines = (await readFile(file, "utf8")).split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length !== EXPECTED_COUNT || lines.some((line) => line.trim() !== line || line === "")) {
    throw new Error("Allowlist wajib tepat 417 path");
  }
  const unique = new Set(lines);
  if (unique.size !== lines.length) throw new Error("Allowlist memuat duplikat");
  for (const line of lines) validateObjectPath(line);
  return [...unique].sort();
}

export function assertCloneDatabaseUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Database URL clone tidak valid"); }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol) ||
      !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) ||
      parsed.pathname !== "/phase13_current_prod") {
    throw new Error("Database wajib clone localhost phase13_current_prod");
  }
  return parsed.href;
}

function assertStagingUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Target staging URL tidak valid"); }
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || parsed.port !== "18100" ||
      parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Target wajib tunnel staging http://127.0.0.1:18100");
  }
  return parsed.href.replace(/\/$/, "");
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function hashFile(file, maxBytes) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maxBytes) {
    throw new Error("File backup tidak aman atau terlalu besar");
  }
  const hash = createHash("sha256");
  const chunks = [];
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), size: metadata.size, sha256: hash.digest("hex") };
}

async function loadManifest(file) {
  await assertRegularFile(file, "Manifest");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  if (manifest.version !== 1 || manifest.target !== "production" || manifest.algorithm !== "sha256" ||
      !Array.isArray(manifest.files)) throw new Error("Manifest production tidak valid");
  const entries = new Map();
  for (const item of manifest.files) {
    if (!/^[a-f0-9]{64}$/.test(item?.pathDigest) || !/^[a-f0-9]{64}$/.test(item?.sha256) ||
        entries.has(item.pathDigest)) throw new Error("Entry manifest tidak valid");
    entries.set(item.pathDigest, item.sha256);
  }
  if (entries.size !== manifest.fileCount) throw new Error("Jumlah entry manifest tidak cocok");
  return entries;
}

async function queryMappings(databaseUrl, names, dependencies) {
  if (dependencies.queryMappings) return dependencies.queryMappings(databaseUrl, names);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(
      "SELECT id::text, name FROM storage.objects WHERE bucket_id = 'avatars' AND name = ANY($1::text[])",
      [names],
    );
    await client.query("ROLLBACK");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

function objectUrl(base, name) {
  const encoded = name.split("/").map(encodeURIComponent).join("/");
  return new URL("/storage/v1/object/academy-private/" + encoded, base);
}

async function targetRequest(target, name, options = {}) {
  return target.fetch(objectUrl(target.url, name), {
    ...options,
    headers: { apikey: target.key, Authorization: "Bearer " + target.key, ...options.headers },
    signal: AbortSignal.timeout(60000),
  });
}

async function targetObject(target, name, maxBytes) {
  const response = await targetRequest(target, name);
  if (response.status === 404) return null;
  if (response.status === 400) {
    const body = await response.clone().json().catch(() => null);
    if (body?.statusCode === "404" && body?.code === "NoSuchKey") return null;
  }
  if (!response.ok) throw new Error("Permintaan target gagal (HTTP " + response.status + ")");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Objek target terlalu besar");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error("Objek target terlalu besar");
  return { size: buffer.length, sha256: digest(buffer) };
}

async function loadState(file, identity) {
  const metadata = await lstat(file).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (metadata && (!metadata.isFile() || metadata.isSymbolicLink())) throw new Error("State wajib file reguler non-symlink");
  const state = await readFile(file, "utf8").then(JSON.parse, (error) =>
    error.code === "ENOENT" ? { version: 1, identity, completed: {} } : Promise.reject(error));
  if (state.version !== 1 || state.identity !== identity || !state.completed || Array.isArray(state.completed)) {
    throw new Error("State tidak sesuai pekerjaan ini");
  }
  return state;
}

async function saveState(file, state) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + ".tmp";
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(state, null, 2) + "\n");
  } finally {
    await handle.close();
  }
  await rename(temporary, file);
}

export async function copyBackup(options, dependencies = {}) {
  const environment = dependencies.env ?? process.env;
  const databaseUrl = assertCloneDatabaseUrl(environment[options.databaseUrlEnv]);
  const targetUrl = assertStagingUrl(environment[options.targetUrlEnv]);
  const targetKey = environment[options.targetKeyEnv];
  if (!targetKey) throw new Error("Kredensial target staging belum diisi");
  const backupRoot = await realpath(options.backupRoot);
  if (!(await lstat(backupRoot)).isDirectory()) throw new Error("Backup root wajib direktori nyata");
  const filesRoot = await realpath(path.join(backupRoot, "files"));
  if (!(await lstat(filesRoot)).isDirectory() || !filesRoot.startsWith(backupRoot + path.sep)) {
    throw new Error("Backup root wajib memuat direktori files nyata");
  }

  const names = await readAllowlist(options.allowlist);
  const manifest = await loadManifest(options.manifest);
  const rows = await queryMappings(databaseUrl, names, dependencies);
  const mapping = new Map(rows.map((row) => [row.name, row.id]));
  if (mapping.size !== EXPECTED_COUNT || names.some((name) => !mapping.has(name))) {
    throw new Error("Mapping clone tidak lengkap atau duplikat");
  }

  const target = { url: targetUrl, key: targetKey, fetch: dependencies.fetch ?? fetch };
  const manifestDigest = digest(await readFile(options.manifest));
  const identity = digest([targetUrl, digest(names.join("\0")), manifestDigest].join("\0"));
  const state = await loadState(options.state, identity);
  const summary = { mode: options.apply ? "apply" : "dry-run", discovered: names.length, copied: 0, verified: 0, skipped: 0 };

  for (const name of names) {
    const objectDirectory = path.resolve(filesRoot, "stub", "stub", "avatars", ...name.split("/"));
    if (!objectDirectory.startsWith(filesRoot + path.sep)) throw new Error("Path backup keluar dari root");
    const directoryMetadata = await lstat(objectDirectory);
    if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
      throw new Error("Direktori objek backup tidak aman");
    }
    const children = await readdir(objectDirectory, { withFileTypes: true });
    if (children.length !== 1 || !children[0].isFile() || children[0].isSymbolicLink()) {
      throw new Error("Objek backup wajib tepat satu file reguler");
    }
    const storagePath = "./stub/stub/avatars/" + name + "/" + children[0].name;
    const pathDigest = digest(storagePath);
    const expectedHash = manifest.get(pathDigest);
    if (!expectedHash) throw new Error("Objek allowlist tidak ditemukan dalam manifest");
    const sourcePath = path.resolve(objectDirectory, children[0].name);
    if (sourcePath !== filesRoot && !sourcePath.startsWith(filesRoot + path.sep)) throw new Error("Path backup keluar dari root");
    const source = await hashFile(sourcePath, options.maxBytes);
    if (source.sha256 !== expectedHash) throw new Error("SHA-256 file backup tidak cocok dengan manifest");
    if (!options.apply) continue;

    const existing = await targetObject(target, name, options.maxBytes);
    if (existing) {
      if (existing.size !== source.size || existing.sha256 !== source.sha256) {
        throw new Error("Objek target berbeda; overwrite ditolak");
      }
      summary.skipped += 1;
    } else {
      const response = await targetRequest(target, name, {
        method: "POST",
        body: source.buffer,
        headers: { "Content-Type": name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg", "x-upsert": "false" },
      });
      if (!response.ok) throw new Error("Upload target gagal (HTTP " + response.status + ")");
      summary.copied += 1;
    }
    const verified = await targetObject(target, name, options.maxBytes);
    if (!verified || verified.size !== source.size || verified.sha256 !== source.sha256) {
      throw new Error("Verifikasi SHA-256 target gagal");
    }
    summary.verified += 1;
    state.completed[pathDigest] = { size: source.size, sha256: source.sha256 };
    await saveState(options.state, state);
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log(usage);
    else console.log(JSON.stringify(await copyBackup(options)));
  } catch {
    console.error("Copy backup gagal; detail sensitif tidak ditampilkan.");
    process.exitCode = 1;
  }
}
