#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const STAGING_SUPABASE = "http://127.0.0.1:18100";
const FORBIDDEN = ["supabase.carubra.com", "supabase.carubra.space"];

export function validateBindingConfig(env) {
  if (env.DEPLOY_TARGET !== "staging" || env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_SUPABASE ||
      !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.PHASE13_STAGING_PROBE_TOKEN || env.PHASE13_STAGING_PROBE_TOKEN.length < 32) {
    throw new Error("Environment app staging belum lengkap atau salah target");
  }
  let app;
  try { app = new URL(env.NEXT_PUBLIC_APP_URL); } catch { throw new Error("URL app staging tidak valid"); }
  if (app.protocol !== "http:" || app.hostname !== "127.0.0.1" || !app.port ||
      app.username || app.password || ["3000", "18100", "15532"].includes(app.port) ||
      app.pathname !== "/" || app.search || app.hash) {
    throw new Error("App staging wajib loopback pada port terpisah dari develop dan Supabase");
  }
  return { app: app.origin };
}

function scriptSources(html) {
  return [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
}

export async function verifyAppBinding(env = process.env, fetcher = fetch) {
  const { app } = validateBindingConfig(env);
  const page = await fetcher(`${app}/register`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!page.ok) throw new Error(`Halaman register HTTP ${page.status}`);
  const html = await page.text();
  const sources = scriptSources(html);
  if (!sources.length) throw new Error("Bundle browser tidak ditemukan");
  let stagingMarker = html.includes(STAGING_SUPABASE);
  let forbiddenMarker = FORBIDDEN.some((value) => html.includes(value));
  for (const source of sources) {
    const url = new URL(source, app);
    if (url.origin !== app) continue;
    const response = await fetcher(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) continue;
    const body = await response.text();
    stagingMarker ||= body.includes(STAGING_SUPABASE);
    forbiddenMarker ||= FORBIDDEN.some((value) => body.includes(value));
  }
  const browserSupabaseBinding = stagingMarker && !forbiddenMarker ? "passed" : "failed";
  let serverRuntimeBinding = "failed";
  try {
    const probe = await fetcher(app + "/api/internal/deployment-probe", {
      method: "GET", headers: { "x-phase13-probe-token": env.PHASE13_STAGING_PROBE_TOKEN },
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    const payload = probe.ok ? await probe.json() : null;
    if (payload?.deploymentTarget === "staging" && payload?.supabaseOrigin === STAGING_SUPABASE &&
        payload?.serverRuntimeBinding === "passed" && payload?.authAdminProbe === "passed") {
      serverRuntimeBinding = "passed";
    }
  } catch {}
  return { appHttp: "passed", browserSupabaseBinding, serverRuntimeBinding,
    bindingProven: browserSupabaseBinding === "passed" && serverRuntimeBinding === "passed" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyAppBinding().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.bindingProven) process.exitCode = 1;
  }).catch(() => {
    process.stderr.write("Binding app staging gagal diverifikasi.\n");
    process.exitCode = 1;
  });
}
