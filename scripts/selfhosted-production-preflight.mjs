import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import tls from "node:tls";
import { pathToFileURL } from "node:url";

const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);
const REQUIRED_HEADERS = Object.freeze({
  "strict-transport-security": (value) => Number(/(?:^|;)\s*max-age=(\d+)/i.exec(value)?.[1] ?? 0) >= 15_552_000,
  "x-content-type-options": (value) => value.toLowerCase() === "nosniff",
  "referrer-policy": (value) => value.trim().length > 0,
  "content-security-policy": (value) => value.trim().length > 0,
});
const usage = `Preflight production read-only untuk Academy self-hosted.
  node scripts/selfhosted-production-preflight.mjs --base-url https://academy.example.com \\
    --output /secure/evidence/tls-preflight.json [--health-path /api/health] [--min-cert-days 14]

Target wajib HTTPS hostname publik (bukan IP/localhost). Probe hanya memakai GET tanpa kredensial,
redirect tidak diikuti, dan output evidence production berstatus PASS atau FAIL.`;

function optionMap(args) {
  if (args.length % 2 !== 0) throw new Error(usage);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!args[index].startsWith("--") || values[args[index]] !== undefined) throw new Error(usage);
    values[args[index]] = args[index + 1];
  }
  return values;
}

export function parseProductionPreflightArgs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  const values = optionMap(args);
  const allowed = new Set(["--base-url", "--health-path", "--min-cert-days", "--timeout-ms", "--output"]);
  if (Object.keys(values).some((key) => !allowed.has(key))) throw new Error(usage);
  const base = new URL(values["--base-url"] ?? "");
  if (base.protocol !== "https:" || base.port || base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    throw new Error("base-url wajib origin HTTPS tanpa kredensial, path, query, atau fragment");
  }
  if (base.hostname === "localhost" || base.hostname.endsWith(".localhost") || base.hostname === "0.0.0.0" ||
      base.hostname === "::1" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(base.hostname)) {
    throw new Error("base-url wajib hostname production, bukan localhost atau alamat IP");
  }
  const healthPath = values["--health-path"] ?? "/api/health";
  if (!/^\/[A-Za-z0-9/_-]*$/.test(healthPath) || healthPath.includes("//")) throw new Error("health-path wajib path absolut aman");
  const minCertDays = Number(values["--min-cert-days"] ?? 14);
  const timeoutMs = Number(values["--timeout-ms"] ?? 10_000);
  if (!Number.isInteger(minCertDays) || minCertDays < 7 || minCertDays > 365) throw new Error("min-cert-days wajib 7-365");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) throw new Error("timeout-ms wajib 1000-30000");
  const output = values["--output"];
  if (!output || !path.isAbsolute(output) || path.extname(output).toLowerCase() !== ".json") {
    throw new Error("output wajib path absolut file JSON");
  }
  return { baseUrl: base.origin, healthPath, minCertDays, timeoutMs, output };
}

export function inspectSecurityHeaders(headers) {
  return Object.fromEntries(Object.entries(REQUIRED_HEADERS).map(([name, validate]) => {
    const value = headers.get(name) ?? "";
    return [name, { present: value.length > 0, valid: value.length > 0 && validate(value) }];
  }));
}

function defaultTlsProbe(hostname, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: true });
    const timer = setTimeout(() => socket.destroy(new Error("TLS timeout")), timeoutMs);
    socket.once("secureConnect", () => {
      try {
        if (!socket.authorized) throw new Error(socket.authorizationError || "TLS tidak terotorisasi");
        const certificate = socket.getPeerCertificate();
        if (!certificate?.valid_to) throw new Error("Sertifikat peer tidak tersedia");
        resolve({ validFrom: certificate.valid_from, validTo: certificate.valid_to, fingerprint256: certificate.fingerprint256 });
      } catch (error) { reject(error); }
      finally { clearTimeout(timer); socket.end(); }
    });
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

async function request(fetcher, url, timeoutMs) {
  return fetcher(url, { method: "GET", redirect: "manual", credentials: "omit", cache: "no-store",
    headers: { accept: "application/json,text/html;q=0.9", "user-agent": "academy-production-preflight/1" },
    signal: AbortSignal.timeout(timeoutMs) });
}

function failedCheck(error) {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function runProductionPreflight(config, dependencies = {}) {
  const now = dependencies.now ?? (() => new Date());
  const fetcher = dependencies.fetch ?? fetch;
  const tlsProbe = dependencies.tlsProbe ?? defaultTlsProbe;
  const startedAt = now();
  const base = new URL(config.baseUrl);
  const checks = {};

  try {
    const certificate = await tlsProbe(base.hostname, Number(base.port || 443), config.timeoutMs);
    const expiresAt = new Date(certificate.validTo);
    const remainingDays = (expiresAt.getTime() - startedAt.getTime()) / 86_400_000;
    checks.tls = { ok: Number.isFinite(remainingDays) && remainingDays >= config.minCertDays,
      hostname: base.hostname, validFrom: new Date(certificate.validFrom).toISOString(), validTo: expiresAt.toISOString(),
      remainingDays: Math.floor(remainingDays), fingerprint256: certificate.fingerprint256 ?? null };
  } catch (error) { checks.tls = failedCheck(error); }

  try {
    const httpUrl = new URL(`http://${base.hostname}/`);
    const response = await request(fetcher, httpUrl, config.timeoutMs);
    const location = response.headers.get("location");
    let destination = null;
    try { destination = location ? new URL(location, httpUrl) : null; } catch { destination = null; }
    checks.httpRedirect = { ok: REDIRECT_STATUSES.has(response.status) && destination?.origin === base.origin,
      status: response.status, location };
  } catch (error) { checks.httpRedirect = failedCheck(error); }

  try {
    const response = await request(fetcher, new URL(config.healthPath, base), config.timeoutMs);
    checks.health = { ok: response.status >= 200 && response.status < 300, status: response.status, path: config.healthPath };
  } catch (error) { checks.health = failedCheck(error); }

  try {
    const response = await request(fetcher, base, config.timeoutMs);
    const headers = inspectSecurityHeaders(response.headers);
    checks.securityHeaders = { ok: response.status >= 200 && response.status < 400 &&
      Object.values(headers).every((entry) => entry.valid), status: response.status, headers };
  } catch (error) { checks.securityHeaders = failedCheck(error); }

  const finishedAt = now();
  const passed = Object.values(checks).every((check) => check.ok === true);
  return { schemaVersion: 1, gate: "tlsPreflight", target: "production", mode: "unauthenticated-read-only",
    startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
    expiresAt: new Date(finishedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(), status: passed ? "PASS" : "FAIL",
    subject: { origin: base.origin, hostname: base.hostname, healthPath: config.healthPath },
    policy: { minCertDays: config.minCertDays, timeoutMs: config.timeoutMs }, checks };
}

export async function writeProductionPreflightReport(report, output) {
  const content = `${JSON.stringify(report, null, 2)}\n`;
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, output);
  return { path: output, sizeBytes: Buffer.byteLength(content), sha256: createHash("sha256").update(content).digest("hex") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const config = parseProductionPreflightArgs(process.argv.slice(2));
    if (config.help) console.log(usage);
    else {
      const report = await runProductionPreflight(config);
      const evidence = await writeProductionPreflightReport(report, config.output);
      console.log(JSON.stringify({ status: report.status, evidence }, null, 2));
      if (report.status !== "PASS") process.exitCode = 1;
    }
  } catch (error) {
    console.error(JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}
