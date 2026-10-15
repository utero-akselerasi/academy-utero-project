import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const categories = [
  ["check_in_selfie", "attendances", "check_in_selfie_path", "academy-private"],
  ["check_out_selfie", "attendances", "check_out_selfie_path", "academy-private"],
  ["out_of_range", "attendances", "out_of_range_proof_path", "academy-private"],
  ["sick_certificate", "attendances", "sick_certificate_path", "academy-private"],
  ["permit", "permits", "attachment_path", "academy-private"],
  ["avatar", "user_profiles", "avatar_path", "academy-private"],
  ["cv", "internship_applications", "cv_path", "academy-private"],
  ["portfolio", "internship_applications", "portfolio_path", "academy-private"],
  ["certificate_template", "attendance_settings", "certificate_template_path", "academy-private"],
  ["daily_report_attachment", "daily_report_attachments", "file_path", "daily-report"],
];

export function validateConfig(env) {
  let database;
  try { database = new URL(env.PHASE13_RECONCILED_DATABASE_URL); } catch { throw new Error("Clone database URL tidak valid"); }
  if (!/^postgres(?:ql)?:$/.test(database.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
      database.pathname !== "/phase13_reconciled_prod_20261012" || database.search || database.hash) {
    throw new Error("Database wajib clone lokal phase13_reconciled_prod_20261012");
  }
  if (env.SUPABASE_STAGING_URL !== "http://127.0.0.1:18100" || !env.SUPABASE_STAGING_SERVICE_ROLE_KEY ||
      !env.SUPABASE_STAGING_ANON_KEY) throw new Error("Kredensial tunnel staging belum valid");
  return { databaseUrl: database.href, base: env.SUPABASE_STAGING_URL,
    serviceKey: env.SUPABASE_STAGING_SERVICE_ROLE_KEY, anonKey: env.SUPABASE_STAGING_ANON_KEY };
}

export function objectPath(value, bucket) {
  if (typeof value !== "string" || !value.trim()) return null;
  let result = value.trim();
  if (/^https?:\/\//i.test(result)) {
    let parsed;
    try { parsed = new URL(result); } catch { return null; }
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match || ![bucket, ...(bucket === "academy-private" ? ["avatars"] : [])].includes(match[1])) return null;
    try { result = decodeURIComponent(match[2]); } catch { return null; }
  }
  result = result.replace(/^\/+/, "");
  if (!result || result.trim() !== result || /[\u0000-\u001f\u007f\\?#]/.test(result) ||
      result.split("/").some((segment) => !segment || segment === "." || segment === "..")) return null;
  return result;
}

function urlFor(base, type, bucket, name) {
  return `${base}/storage/v1/object/${type}/${bucket}/${name.split("/").map(encodeURIComponent).join("/")}`;
}

async function bytes(response) {
  if (!response.ok) return null;
  const declared = Number(response.headers.get("content-length"));
  if (declared > 21 * 1024 * 1024) return null;
  const content = Buffer.from(await response.arrayBuffer());
  return content.length <= 21 * 1024 * 1024 ? content : null;
}

async function probe(config, bucket, name, fetcher) {
  const object = urlFor(config.base, "authenticated", bucket, name);
  const serviceHeaders = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` };
  const direct = await bytes(await fetcher(object, { method: "GET", headers: serviceHeaders }));
  if (!direct) return false;
  const publicResponse = await fetcher(urlFor(config.base, "public", bucket, name), { method: "GET" });
  if (![400, 401, 403, 404].includes(publicResponse.status)) return false;
  const anonResponse = await fetcher(object, { method: "GET", headers: {
    apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`,
  } });
  if (![400, 401, 403, 404].includes(anonResponse.status)) return false;
  const signedResponse = await fetcher(urlFor(config.base, "sign", bucket, name), {
    method: "POST", headers: { ...serviceHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  if (!signedResponse.ok) return false;
  let signed;
  try { signed = (await signedResponse.json()).signedURL; } catch { return false; }
  if (typeof signed !== "string") return false;
  let signedUrl;
  try {
    signedUrl = new URL(signed.startsWith("/object/sign/") ? `/storage/v1${signed}` : signed, config.base);
  } catch { return false; }
  if (signedUrl.origin !== config.base ||
      signedUrl.pathname !== new URL(urlFor(config.base, "sign", bucket, name)).pathname ||
      !signedUrl.searchParams.get("token")) return false;
  const signedBytes = await bytes(await fetcher(signedUrl.href, { method: "GET" }));
  return Boolean(signedBytes && signedBytes.length === direct.length &&
    createHash("sha256").update(signedBytes).digest("hex") === createHash("sha256").update(direct).digest("hex"));
}

export async function smokeStaging(dependencies = {}) {
  const config = validateConfig(dependencies.env ?? process.env);
  const fetcher = dependencies.fetch ?? fetch;
  const query = dependencies.query;
  if (!query) throw new Error("Pembaca clone belum tersedia");
  const result = {};
  for (const [category, table, column, bucket] of categories) {
    let values;
    try {
      values = await query(`select ${column} as value from utero_academy.${table} where ${column} is not null and btrim(${column}) <> '' ${category === "daily_report_attachment" ? "and mime_type <> 'url'" : ""} order by ${category === "daily_report_attachment" ? "created_at desc" : column} limit 100`);
    } catch { result[category] = "failed"; continue; }
    const candidates = [...new Set(values.map((row) => objectPath(row.value, bucket)).filter(Boolean))];
    if (!candidates.length) { result[category] = "missing"; continue; }
    result[category] = "failed";
    for (const name of candidates) {
      try { if (await probe(config, bucket, name, fetcher)) { result[category] = "passed"; break; } }
      catch { /* Failure is reported without leaking request details. */ }
    }
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let client;
  try {
    const config = validateConfig(process.env);
    const { default: pg } = await import("pg");
    client = new pg.Client({ connectionString: config.databaseUrl });
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const result = await smokeStaging({ query: async (sql) => (await client.query(sql)).rows });
    await client.query("ROLLBACK");
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (Object.values(result).some((status) => status !== "passed")) process.exitCode = 1;
  } catch {
    process.stderr.write("Smoke staging gagal; periksa clone, tunnel, kredensial, dan Storage.\n");
    process.exitCode = 1;
  } finally { if (client) await client.end().catch(() => {}); }
}
