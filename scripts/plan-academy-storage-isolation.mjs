import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, open, realpath, stat } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const runFile = promisify(execFile);
async function lockPrivate(target) {
  if (process.platform === "win32") {
    const identity = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
    if (!process.env.USERDOMAIN || !process.env.USERNAME) throw new Error("Identitas operator Windows tidak tersedia");
    const directory = (await lstat(target)).isDirectory();
    const inheritance = directory ? "(OI)(CI)" : "";
    await runFile("icacls.exe", [target, "/inheritance:r", "/grant:r",
      `${identity}:${inheritance}F`, `SYSTEM:${inheritance}F`, `Administrators:${inheritance}F`],
    { windowsHide: true });
  } else {
    await chmod(target, 0o700);
  }
}
const COLUMNS = [
  ["attendances", "check_in_selfie_path"],
  ["attendances", "check_out_selfie_path"],
  ["attendances", "out_of_range_proof_path"],
  ["attendances", "sick_certificate_path"],
  ["permits", "attachment_path"],
  ["user_profiles", "avatar_path"],
  ["internship_applications", "cv_path"],
  ["internship_applications", "portfolio_path"],
  ["attendance_settings", "certificate_template_path"],
];

export function parseOptions(args) {
  const names = new Set(["--reconciled-url-env", "--develop-url-env", "--production-url-env", "--output-dir"]);
  if (args.length !== 8 || args.some((value, index) => index % 2 === 0 && !names.has(value))) {
    throw new Error("Argumen planner tidak valid");
  }
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    if (values.has(args[index])) throw new Error("Argumen planner duplikat");
    values.set(args[index], args[index + 1]);
  }
  const envNames = ["--reconciled-url-env", "--develop-url-env", "--production-url-env"].map((key) => values.get(key));
  if (envNames.some((name) => !/^[A-Z_][A-Z0-9_]*$/.test(name ?? "")) || new Set(envNames).size !== 3) {
    throw new Error("Nama environment variable tidak valid atau duplikat");
  }
  const outputDir = values.get("--output-dir");
  if (!outputDir || !path.isAbsolute(outputDir) || path.resolve(outputDir) === REPOSITORY ||
    path.resolve(outputDir).startsWith(`${REPOSITORY}${path.sep}`)) {
    throw new Error("Output wajib path absolut di luar repo");
  }
  return { envNames, outputDir };
}

export function normalizeAvatarPath(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Referensi Storage tidak valid");
  const trimmed = value.trim();
  let objectPath = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    let url;
    try { url = new URL(trimmed); } catch { throw new Error("URL Storage tidak valid"); }
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/avatars\/(.*)$/);
    if (!match || !match[1]) throw new Error("URL bukan objek avatars");
    try { objectPath = decodeURIComponent(match[1]); } catch { throw new Error("Encoding path Storage tidak valid"); }
  }
  objectPath = objectPath.replace(/^\/+/, "");
  if (!objectPath || objectPath.trim() !== objectPath || /[\u0000-\u001f\u007f\\?#]/.test(objectPath) ||
    objectPath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Object path tidak aman");
  }
  return objectPath;
}

function signature(row) {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Metadata Storage tidak lengkap");
  const size = Number(metadata.size);
  const etag = metadata.eTag ?? metadata.etag;
  if (!Number.isSafeInteger(size) || size < 0 || typeof etag !== "string" || !etag.trim()) {
    throw new Error("Ukuran/eTag Storage tidak lengkap");
  }
  return `${size}\0${etag}`;
}

function digest(paths) {
  return createHash("sha256").update(paths.join("\n") + "\n").digest("hex");
}

export async function buildPlan(query) {
  const references = new Set();
  for (const [table, column] of COLUMNS) {
    const rows = await query("reconciled", `select ${column} as value from utero_academy.${table} where ${column} is not null and btrim(${column}) <> ''`);
    for (const row of rows) references.add(normalizeAvatarPath(row.value));
  }
  const inventory = {};
  for (const source of ["production", "develop"]) {
    const rows = await query(source, "select name, metadata from storage.objects where bucket_id = 'avatars'");
    const objects = new Map();
    for (const row of rows) {
      if (objects.has(row.name)) throw new Error("Duplikat objek Storage");
      objects.set(row.name, row);
    }
    inventory[source] = objects;
  }
  const production = [];
  const develop = [];
  for (const objectPath of references) {
    const prod = inventory.production.get(objectPath);
    const dev = inventory.develop.get(objectPath);
    if (!prod && !dev) throw new Error("Referensi Academy tidak ditemukan di kedua Storage");
    if (prod && dev && signature(prod) !== signature(dev)) throw new Error("Metadata overlap Storage berbeda");
    signature(prod ?? dev);
    (prod ? production : develop).push(objectPath);
  }
  production.sort();
  develop.sort();
  return { production, develop, summary: { total: references.size, production: production.length,
    develop: develop.length, productionDigest: digest(production), developDigest: digest(develop) } };
}

async function secureDirectory(directory) {
  const resolved = path.resolve(directory);
  const root = path.parse(resolved).root;
  let current = root;
  for (const component of resolved.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Output melewati symlink atau bukan direktori");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await mkdir(current, { mode: 0o700 });
    }
  }
  const actual = await realpath(resolved);
  if (actual === REPOSITORY || actual.startsWith(`${REPOSITORY}${path.sep}`)) throw new Error("Output berada dalam repo");
  await lockPrivate(actual);
  const info = await stat(actual);
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) throw new Error("Direktori output harus privat (0700)");
  return actual;
}

export async function writePlan(directory, plan) {
  const output = await secureDirectory(directory);
  for (const [file, entries] of [["production-paths.txt", plan.production], ["develop-paths.txt", plan.develop]]) {
    const handle = await open(path.join(output, file), "wx", 0o600);
    try { await handle.writeFile(entries.length ? `${entries.join("\n")}\n` : ""); }
    finally { await handle.close(); }
    if (process.platform === "win32") await lockPrivate(path.join(output, file));
    else await chmod(path.join(output, file), 0o600);
  }
}

export async function planIsolation(options, dependencies) {
  const urls = options.envNames.map((name) => dependencies.env[name]);
  if (urls.some((url) => !url || !/^postgres(?:ql)?:\/\//.test(url))) throw new Error("PostgreSQL URL tidak tersedia");
  const clients = Object.fromEntries(["reconciled", "develop", "production"].map((name, index) => [name, urls[index]]));
  const plan = await buildPlan((name, sql) => dependencies.query(clients[name], sql));
  await writePlan(options.outputDir, plan);
  return plan.summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    const { default: pg } = await import("pg");
    const clients = new Map();
    const connected = new Set();
    try {
      const summary = await planIsolation(options, { env: process.env, query: async (url, sql) => {
        if (!clients.has(url)) clients.set(url, new pg.Client({ connectionString: url }));
        const client = clients.get(url);
        if (!connected.has(url)) { await client.connect(); connected.add(url); }
        return (await client.query(sql)).rows;
      } });
      process.stdout.write(`${JSON.stringify(summary)}\n`);
    } finally { await Promise.all([...clients.values()].map((client) => client.end().catch(() => {}))); }
  } catch {
    process.stderr.write("Planner gagal; periksa input, metadata, izin output, dan koneksi.\n");
    process.exitCode = 1;
  }
}
