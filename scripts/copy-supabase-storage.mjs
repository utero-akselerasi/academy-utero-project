#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PAGE_SIZE = 1000;
const usage = `Copy objek Supabase Storage (dry-run default).
  node scripts/copy-supabase-storage.mjs --source-url-env NAME --source-key-env NAME --target-url-env NAME --target-key-env NAME --source-bucket BUCKET --target-bucket BUCKET [--prefix PATH]
  node scripts/copy-supabase-storage.mjs ... [--path-list /absolute/private/paths.txt]
  node scripts/copy-supabase-storage.mjs ... --apply true --state /absolute/private/state.json [--overwrite true]

Kredensial dibaca dari environment variable yang namanya diberikan. Nilai token, URL, dan object path
tidak dicetak. Mode apply memverifikasi SHA-256 dan ukuran setelah upload, serta menyimpan state atomik
untuk resume. File state dan path-list dapat memuat object path; simpan di lokasi privat di luar repository.
Copy apply dari bucket avatars ke academy-private wajib memakai --path-list.`;

function value(args, name) {
  const indexes = args.flatMap((item, index) => item === name ? [index] : []);
  if (indexes.length > 1 || (indexes.length === 1 && !args[indexes[0] + 1])) throw new Error("Argumen tidak valid");
  return indexes.length ? args[indexes[0] + 1] : undefined;
}

function safeName(input, label) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(input ?? "")) throw new Error(`${label} tidak valid`);
  return input;
}

export function parseOptions(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length % 2 !== 0 || args.some((item, index) => index % 2 === 0 && !item.startsWith("--"))) {
    throw new Error("Argumen harus berupa pasangan --nama nilai");
  }
  const allowed = new Set(["--source-url-env", "--source-key-env", "--target-url-env", "--target-key-env",
    "--source-bucket", "--target-bucket", "--prefix", "--path-list", "--apply", "--state", "--overwrite", "--max-bytes"]);
  if (args.some((item, index) => index % 2 === 0 && !allowed.has(item))) throw new Error("Argumen tidak dikenal");
  const apply = value(args, "--apply") === "true";
  const overwrite = value(args, "--overwrite") === "true";
  if (value(args, "--apply") && !apply) throw new Error("Gunakan --apply true");
  if (value(args, "--overwrite") && !overwrite) throw new Error("Gunakan --overwrite true");
  if (overwrite && !apply) throw new Error("Overwrite hanya berlaku pada mode apply");
  const envPattern = /^[A-Z_][A-Z0-9_]*$/;
  const envNames = {
    sourceUrl: value(args, "--source-url-env"), sourceKey: value(args, "--source-key-env"),
    targetUrl: value(args, "--target-url-env"), targetKey: value(args, "--target-key-env"),
  };
  if (Object.values(envNames).some((name) => !envPattern.test(name ?? ""))) throw new Error("Nama environment variable tidak valid");
  const sourceBucket = safeName(value(args, "--source-bucket"), "Source bucket");
  const targetBucket = safeName(value(args, "--target-bucket"), "Target bucket");
  const prefix = value(args, "--prefix") ?? "";
  validateObjectPath(prefix, true);
  const pathList = value(args, "--path-list");
  if (pathList && !path.isAbsolute(pathList)) throw new Error("Path-list wajib path absolut");
  if (pathList && prefix) throw new Error("Gunakan --prefix atau --path-list, bukan keduanya");
  const state = value(args, "--state");
  if (apply && (!state || !path.isAbsolute(state))) throw new Error("Mode apply wajib memakai --state path absolut");
  for (const privatePath of [state, pathList].filter(Boolean)) {
    const repository = path.resolve(import.meta.dirname, "..");
    const relative = path.relative(repository, path.resolve(privatePath));
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) throw new Error("File privat harus berada di luar repository");
  }
  if (apply && sourceBucket === "avatars" && targetBucket !== "academy-private") {
    throw new Error("Target copy Academy dari avatars wajib academy-private");
  }
  if (apply && sourceBucket === "avatars" && !pathList) {
    throw new Error("Copy apply avatars ke academy-private wajib memakai --path-list");
  }
  const maxBytes = Number(value(args, "--max-bytes") ?? 100 * 1024 * 1024);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Max bytes tidak valid");
  return { apply, overwrite, envNames, sourceBucket, targetBucket, prefix, pathList, state, maxBytes };
}

function validateObjectPath(name, allowEmpty = false) {
  if (allowEmpty && name === "") return;
  if (!name || name.startsWith("/") || name.endsWith("/") || name.includes("\0") || name.split("/").some((part) =>
    !part || part === "." || part === "..")) throw new Error("Object path tidak aman");
}

function endpoint(base, route, bucket, objectPath = "") {
  const parts = [bucket, ...objectPath.split("/").filter(Boolean)].map(encodeURIComponent).join("/");
  return new URL(`/storage/v1/${route}/${parts}`, base);
}

function redactError(status) {
  return new Error(`Permintaan Storage gagal (HTTP ${status})`);
}

async function request(target, url, options = {}) {
  assertCopyOnlySourceRequest(target, url, options);
  const response = await target.fetch(url, {
    ...options,
    headers: { apikey: target.key, Authorization: `Bearer ${target.key}`, ...options.headers },
    signal: AbortSignal.timeout(60000),
  });
  if (response.status === 400 && (!options.method || options.method === "GET") &&
      url.pathname.startsWith("/storage/v1/object/")) {
    const body = await response.clone().json().catch(() => null);
    if (body?.statusCode === "404" && body?.code === "NoSuchKey") throw redactError(404);
  }
  if (!response.ok) throw redactError(response.status);
  return response;
}

function assertCopyOnlySourceRequest(target, url, options = {}) {
  const listing = options.method === "POST" && url.pathname.startsWith("/storage/v1/object/list/");
  if (target.role === "source" && options.method && options.method !== "GET" && !listing) {
    throw new Error("Source Storage hanya boleh dibaca");
  }
}

export function digestPath(name) {
  return createHash("sha256").update(name).digest("hex");
}

export function digestBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function listObjects(target, bucket, rootPrefix) {
  const files = [];
  const prefixes = [rootPrefix];
  const visited = new Set();
  while (prefixes.length) {
    const prefix = prefixes.shift();
    if (visited.has(prefix)) continue;
    visited.add(prefix);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const response = await request(target, endpoint(target.url, "object/list", bucket), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } }),
      });
      const entries = await response.json();
      if (!Array.isArray(entries)) throw new Error("Respons daftar Storage tidak valid");
      for (const entry of entries) {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        validateObjectPath(name);
        if (entry.id === null) prefixes.push(name);
        else if (entry.id) files.push({ name, listedSize: Number(entry.metadata?.size) });
      }
      if (entries.length < PAGE_SIZE) break;
    }
  }
  return files.sort((left, right) => left.name.localeCompare(right.name));
}

export async function readPathList(file) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Path-list harus file reguler non-symlink");
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (!lines.length || lines.some((line) => line === "" || line.trim() !== line)) {
    throw new Error("Path-list wajib berisi satu object path per baris");
  }
  const unique = new Set();
  for (const line of lines) {
    validateObjectPath(line);
    if (unique.has(line)) throw new Error("Path-list memuat object path duplikat");
    unique.add(line);
  }
  return [...unique].sort().map((name) => ({ name, listedSize: Number.NaN }));
}

async function download(target, bucket, name, maxBytes) {
  const response = await request(target, endpoint(target.url, "object", bucket, name));
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Objek melampaui batas ukuran");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error("Objek melampaui batas ukuran");
  return { buffer, size: buffer.length, sha256: digestBuffer(buffer), contentType: response.headers.get("content-type") };
}

async function upload(target, bucket, name, source, overwrite) {
  await request(target, endpoint(target.url, "object", bucket, name), {
    method: "POST", body: source.buffer,
    headers: { "Content-Type": source.contentType || "application/octet-stream", "x-upsert": String(overwrite) },
  });
}

async function loadState(statePath, identity) {
  const metadata = await lstat(statePath).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (metadata && (!metadata.isFile() || metadata.isSymbolicLink())) throw new Error("State bukan file reguler");
  const state = await readFile(statePath, "utf8").then(JSON.parse, (error) => {
    if (error.code === "ENOENT") return { version: 1, identity, completed: {} };
    throw error;
  });
  if (state.version !== 1 || state.identity !== identity || !state.completed || Array.isArray(state.completed)) {
    throw new Error("State tidak sesuai pekerjaan ini");
  }
  return state;
}

async function saveState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporary = `${statePath}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`); } finally { await handle.close(); }
  await rename(temporary, statePath);
}

function sameObject(expected, actual) {
  return expected.size === actual.size && expected.sha256 === actual.sha256;
}

export async function copyStorage(options, dependencies = {}) {
  const environment = dependencies.env ?? process.env;
  const fetchImplementation = dependencies.fetch ?? fetch;
  const credentials = Object.fromEntries(Object.entries(options.envNames).map(([key, name]) => [key, environment[name]]));
  if (Object.values(credentials).some((item) => !item)) throw new Error("Environment variable kredensial belum diisi");
  const source = { url: credentials.sourceUrl, key: credentials.sourceKey, fetch: fetchImplementation, role: "source" };
  const target = { url: credentials.targetUrl, key: credentials.targetKey, fetch: fetchImplementation, role: "target" };
  for (const item of [source, target]) {
    try {
      const parsed = new URL(item.url);
      if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) throw new Error("invalid");
    } catch { throw new Error("URL Supabase tidak valid"); }
  }
  const normalizedSource = new URL(source.url).href.replace(/\/$/, "");
  const normalizedTarget = new URL(target.url).href.replace(/\/$/, "");
  if (normalizedSource === normalizedTarget && options.sourceBucket === options.targetBucket) {
    throw new Error("Source URL dan bucket tidak boleh identik dengan target");
  }
  const objects = options.pathList
    ? await readPathList(options.pathList)
    : await listObjects(source, options.sourceBucket, options.prefix);
  const selectionDigest = options.pathList ? digestPath(objects.map(({ name }) => name).join("\0")) : options.prefix;
  const identity = digestPath([normalizedSource, options.sourceBucket, normalizedTarget,
    options.targetBucket, selectionDigest].join("\0"));
  const state = options.apply ? await loadState(options.state, identity) : null;
  const summary = { mode: options.apply ? "apply" : "dry-run", discovered: objects.length, copied: 0, verified: 0, skipped: 0 };
  for (const object of objects) {
    const pathDigest = digestPath(object.name);
    if (!options.apply) continue;
    const sourceObject = await download(source, options.sourceBucket, object.name, options.maxBytes);
    if (Number.isFinite(object.listedSize) && object.listedSize !== sourceObject.size) throw new Error("Ukuran source berubah saat proses");
    const completed = state.completed[pathDigest];
    if (completed && completed.size === sourceObject.size && completed.sha256 === sourceObject.sha256) {
      const actual = await download(target, options.targetBucket, object.name, options.maxBytes);
      if (sameObject(sourceObject, actual)) { summary.skipped += 1; summary.verified += 1; continue; }
    }
    let existing = null;
    try { existing = await download(target, options.targetBucket, object.name, options.maxBytes); } catch (error) {
      if (!String(error.message).includes("HTTP 404")) throw error;
    }
    if (existing && sameObject(sourceObject, existing)) {
      summary.skipped += 1;
    } else {
      if (existing && !options.overwrite) throw new Error("Objek target berbeda; gunakan --overwrite true setelah audit");
      await upload(target, options.targetBucket, object.name, sourceObject, Boolean(existing));
      summary.copied += 1;
    }
    const verified = await download(target, options.targetBucket, object.name, options.maxBytes);
    if (!sameObject(sourceObject, verified)) throw new Error("Verifikasi hash/ukuran target gagal");
    summary.verified += 1;
    state.completed[pathDigest] = { path: object.name, size: sourceObject.size, sha256: sourceObject.sha256 };
    await saveState(options.state, state);
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log(usage);
    else console.log(JSON.stringify(await copyStorage(options)));
  } catch (error) {
    console.error(`Copy Storage gagal: ${error instanceof Error ? error.message : "Kesalahan tidak dikenal"}`);
    process.exitCode = 1;
  }
}
