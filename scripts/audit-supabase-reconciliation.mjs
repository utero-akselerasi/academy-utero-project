#!/usr/bin/env node

/** Baca-saja. Tidak ada INSERT, UPDATE, DELETE, upload, atau pencetakan PII. */
import { createHash } from "node:crypto";

const TARGETS = {
  develop: { url: "https://supabase.carubra.com", host: "20.20.20.173", key: process.env.SUPABASE_DEV_SERVICE_ROLE_KEY },
  production: { url: "https://supabase.carubra.space", host: "20.20.20.3", key: process.env.SUPABASE_PROD_SERVICE_ROLE_KEY },
};

const TABLES = [
  "user_profiles", "intern_profiles", "roles", "user_roles", "schools", "school_contacts",
  "mentor_profiles", "programs", "internship_applications", "attendances", "daily_reports", "audit_logs",
];
const PAGE_SIZE = 500;
const MAX_PAGES = 500;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([first], [second]) => first.localeCompare(second))
      .map(([key, item]) => [key, canonical(item)]));
  }
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

async function request(target, path, options = {}) {
  const response = await fetch(new URL(path, target.url), {
    ...options,
    headers: {
      apikey: target.key, Authorization: `Bearer ${target.key}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`Permintaan baca gagal: ${target.url} ${path.split("?")[0]} HTTP ${response.status}`);
  }
  return response.json();
}

async function rows(target, table) {
  const result = new Map();
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await request(target,
      `/rest/v1/${table}?select=*&order=id.asc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      { headers: { "Accept-Profile": "utero_academy" } });
    if (!Array.isArray(batch)) throw new Error(`Respons tabel ${table} tidak valid.`);
    for (const row of batch) {
      if (!row.id || result.has(row.id)) throw new Error(`ID hilang atau duplikat di ${table}.`);
      result.set(row.id, digest(row));
    }
    if (batch.length < PAGE_SIZE) return result;
  }
  throw new Error(`Batas halaman terlampaui pada ${table}.`);
}

async function authUsers(target) {
  const result = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await request(target, `/auth/v1/admin/users?page=${page}&per_page=200`);
    if (!Array.isArray(response.users)) throw new Error("Respons Auth Admin tidak valid.");
    for (const user of response.users) {
      if (!user.id || result.has(user.id)) throw new Error("ID Auth duplikat atau halaman tidak bergerak.");
      result.set(user.id, digest({ id: user.id, email: user.email, phone: user.phone,
        app_metadata: user.app_metadata, user_metadata: user.user_metadata,
        email_confirmed_at: user.email_confirmed_at, banned_until: user.banned_until }));
    }
    if (response.users.length === 0) return result;
  }
  throw new Error("Batas halaman Auth terlampaui.");
}

async function storageBuckets(target) {
  const buckets = await request(target, "/storage/v1/bucket");
  if (!Array.isArray(buckets)) throw new Error("Respons Storage bucket tidak valid.");
  return buckets.map(({ id, public: isPublic }) => ({ id, public: isPublic }));
}

async function storageObjects(target, bucket) {
  const result = new Map();
  const prefixes = [""];
  const visited = new Set();
  while (prefixes.length) {
    const prefix = prefixes.shift();
    if (visited.has(prefix)) continue;
    visited.add(prefix);
    for (let page = 0; page < MAX_PAGES; page++) {
      const entries = await request(target, `/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: PAGE_SIZE, offset: page * PAGE_SIZE, sortBy: { column: "name", order: "asc" } }),
      });
      if (!Array.isArray(entries)) throw new Error("Respons daftar Storage tidak valid.");
      for (const entry of entries) {
        const name = `${prefix}${entry.name}`;
        if (entry.id === null) prefixes.push(`${name}/`);
        else if (entry.id) {
          if (result.has(name)) throw new Error("Object path Storage duplikat.");
          result.set(name, digest({ size: entry.metadata?.size ?? null, mime: entry.metadata?.mimetype ?? null }));
        }
      }
      if (entries.length < PAGE_SIZE) break;
      if (page === MAX_PAGES - 1) throw new Error("Batas halaman Storage terlampaui.");
    }
  }
  return result;
}

function compare(develop, production) {
  const onlyDevelop = [...develop.keys()].filter((id) => !production.has(id));
  const onlyProduction = [...production.keys()].filter((id) => !develop.has(id));
  const changed = [...develop].filter(([id, hash]) => production.has(id) && production.get(id) !== hash);
  return { develop: develop.size, production: production.size,
    onlyDevelop: onlyDevelop.length, onlyProduction: onlyProduction.length, sharedChanged: changed.length };
}

async function main() {
  if (process.argv.slice(2).some((arg) => !["--skip-storage"].includes(arg))) throw new Error("Opsi hanya --skip-storage.");
  for (const [name, target] of Object.entries(TARGETS)) {
    if (!target.key) throw new Error(`SUPABASE_${name === "develop" ? "DEV" : "PROD"}_SERVICE_ROLE_KEY wajib diisi.`);
  }
  const report = { inspectedAt: new Date().toISOString(), readOnly: true, targets: {
    develop: { domain: TARGETS.develop.url, ip: TARGETS.develop.host },
    production: { domain: TARGETS.production.url, ip: TARGETS.production.host },
  }, tables: {}, auth: null, storage: {}, dataParity: false, safeForCutover: false,
  limitation: "Bukan verifikasi checksum byte Storage, backup PostgreSQL, atau kesetaraan password/session Auth." };
  for (const table of TABLES) {
    const [develop, production] = await Promise.all([rows(TARGETS.develop, table), rows(TARGETS.production, table)]);
    report.tables[table] = compare(develop, production);
  }
  const [developUsers, productionUsers] = await Promise.all([authUsers(TARGETS.develop), authUsers(TARGETS.production)]);
  report.auth = compare(developUsers, productionUsers);
  if (!process.argv.includes("--skip-storage")) {
    const [developBuckets, productionBuckets] = await Promise.all([storageBuckets(TARGETS.develop), storageBuckets(TARGETS.production)]);
    report.storage.buckets = compare(new Map(developBuckets.map((bucket) => [bucket.id, digest(bucket)])), new Map(productionBuckets.map((bucket) => [bucket.id, digest(bucket)])));
    for (const bucket of [...new Set([...developBuckets, ...productionBuckets].map(({ id }) => id))].sort()) {
      if (!developBuckets.some(({ id }) => id === bucket) || !productionBuckets.some(({ id }) => id === bucket)) continue;
      const [develop, production] = await Promise.all([storageObjects(TARGETS.develop, bucket), storageObjects(TARGETS.production, bucket)]);
      report.storage[bucket] = compare(develop, production);
    }
  }
  const sections = [...Object.values(report.tables), report.auth, ...Object.values(report.storage).filter((value) => value && typeof value === "object")];
  report.dataParity = !process.argv.includes("--skip-storage") && sections.every(({ onlyDevelop, onlyProduction, sharedChanged }) => !onlyDevelop && !onlyProduction && !sharedChanged);
  console.log(JSON.stringify(report, null, 2));
  if (!report.dataParity) process.exitCode = 2;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
