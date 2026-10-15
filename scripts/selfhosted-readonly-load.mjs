#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LIMITS = Object.freeze({ requests: 500, concurrency: 10, timeoutMs: 15_000, paths: 10 });
const usage = `Probe smoke/load read-only untuk Academy self-hosted.
  node scripts/selfhosted-readonly-load.mjs --base-url https://academy.example.com \\
    --paths /api/health,/login --requests 100 --concurrency 4 \\
    --p95-ms 1500 --max-error-rate 0.01 --output /secure/evidence/uat-readonly.json

Hanya GET/HEAD tanpa kredensial. HTTPS wajib kecuali loopback. Maksimum 500 request,
concurrency 10, timeout 15000 ms, dan 10 path. Redirect tidak diikuti.`;

function integer(value, name, fallback, maximum) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) throw new Error(`${name} wajib 1-${maximum}`);
  return parsed;
}

function decimal(value, name, fallback, maximum) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > maximum) throw new Error(`${name} wajib 0-${maximum}`);
  return parsed;
}

export function parseReadonlyLoadArgs(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Argumen tidak valid\n${usage}`);
    values[key] = value;
  }
  const base = new URL(values["--base-url"] ?? "");
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(base.hostname);
  if ((!loopback && base.protocol !== "https:") || (loopback && !["http:", "https:"].includes(base.protocol)) ||
      base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    throw new Error("Base URL wajib origin HTTPS tanpa kredensial, query, atau path; HTTP hanya untuk loopback");
  }
  const paths = (values["--paths"] ?? "/api/health,/login").split(",").map((entry) => entry.trim());
  if (!paths.length || paths.length > LIMITS.paths || paths.some((entry) => !/^\/[A-Za-z0-9_./-]*$/.test(entry) || entry.includes(".."))) {
    throw new Error(`Paths wajib 1-${LIMITS.paths} path absolut aman tanpa query`);
  }
  const output = values["--output"];
  if (output && !path.isAbsolute(output)) throw new Error("Output wajib path absolut");
  return {
    baseUrl: base.origin,
    target: loopback ? "local" : "production",
    paths,
    requests: integer(values["--requests"], "requests", 100, LIMITS.requests),
    concurrency: integer(values["--concurrency"], "concurrency", 4, LIMITS.concurrency),
    timeoutMs: integer(values["--timeout-ms"], "timeout-ms", 10_000, LIMITS.timeoutMs),
    p95BudgetMs: integer(values["--p95-ms"], "p95-ms", 1_500, 60_000),
    maxErrorRate: decimal(values["--max-error-rate"], "max-error-rate", 0.01, 1),
    output,
  };
}

function percentile(values, percent) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((percent / 100) * sorted.length) - 1];
}

async function oneRequest(config, requestNumber, fetcher, clock) {
  const route = config.paths[requestNumber % config.paths.length];
  const started = clock();
  try {
    const response = await fetcher(new URL(route, config.baseUrl), {
      method: "GET",
      redirect: "manual",
      headers: { accept: "text/html,application/json;q=0.9,*/*;q=0.1", "user-agent": "academy-readonly-uat/1" },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    await response.body?.cancel();
    return { route, status: response.status, durationMs: Math.max(0, clock() - started), ok: response.status >= 200 && response.status < 400 };
  } catch (error) {
    return { route, status: 0, durationMs: Math.max(0, clock() - started), ok: false, error: error?.name ?? "RequestError" };
  }
}

export async function runReadonlyLoad(config, dependencies = {}) {
  const fetcher = dependencies.fetch ?? fetch;
  const clock = dependencies.clock ?? (() => performance.now());
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  let cursor = 0;
  const results = [];
  async function worker() {
    while (cursor < config.requests) {
      const requestNumber = cursor++;
      results.push(await oneRequest(config, requestNumber, fetcher, clock));
    }
  }
  await Promise.all(Array.from({ length: Math.min(config.concurrency, config.requests) }, worker));
  const latencies = results.map((entry) => entry.durationMs);
  const failed = results.filter((entry) => !entry.ok).length;
  const errorRate = failed / results.length;
  const p95Ms = percentile(latencies, 95);
  const statusCounts = Object.fromEntries([...new Set(results.map((entry) => entry.status))].sort((a, b) => a - b)
    .map((status) => [String(status), results.filter((entry) => entry.status === status).length]));
  const pathResults = Object.fromEntries(config.paths.map((route) => {
    const entries = results.filter((entry) => entry.route === route);
    return [route, { requests: entries.length, failures: entries.filter((entry) => !entry.ok).length,
      p95Ms: percentile(entries.map((entry) => entry.durationMs), 95) }];
  }));
  const passed = errorRate <= config.maxErrorRate && p95Ms <= config.p95BudgetMs &&
    Object.values(pathResults).every((entry) => entry.failures < entry.requests);
  return {
    schemaVersion: 1,
    gate: "readonlyUatPerformance",
    target: config.target,
    mode: "unauthenticated-read-only",
    startedAt,
    finishedAt: now().toISOString(),
    expiresAt: new Date(Date.parse(startedAt) + 24 * 60 * 60 * 1000).toISOString(),
    status: passed ? "PASS" : "FAIL",
    limits: { requests: config.requests, concurrency: config.concurrency, timeoutMs: config.timeoutMs,
      p95BudgetMs: config.p95BudgetMs, maxErrorRate: config.maxErrorRate },
    result: { completed: results.length, failed, errorRate, p50Ms: percentile(latencies, 50), p95Ms,
      p99Ms: percentile(latencies, 99), maxMs: Math.max(...latencies), statusCounts, paths: pathResults },
  };
}

export async function writeReadonlyLoadReport(report, output) {
  const content = `${JSON.stringify(report, null, 2)}\n`;
  if (!output) return { content, sha256: createHash("sha256").update(content).digest("hex") };
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, output);
  return { path: output, sha256: createHash("sha256").update(content).digest("hex") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const config = parseReadonlyLoadArgs(process.argv.slice(2));
    if (config.help) console.log(usage);
    else {
      const report = await runReadonlyLoad(config);
      const written = await writeReadonlyLoadReport(report, config.output);
      if (!config.output) process.stdout.write(written.content);
      else console.log(JSON.stringify({ status: report.status, report: written.path, sha256: written.sha256 }));
      if (report.status !== "PASS") process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Probe gagal: ${error.message}\n${usage}`);
    process.exitCode = 1;
  }
}
