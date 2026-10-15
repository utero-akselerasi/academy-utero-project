import { timingSafeEqual } from "node:crypto";

const STAGING_SUPABASE = "http://127.0.0.1:18100";

type ProbeEnv = Record<string, string | undefined>;

function tokenMatches(actual: string | null, expected: string) {
  if (!actual) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function probeStagingDeployment(request: Request, env: ProbeEnv = process.env, fetcher: typeof fetch = fetch) {
  if (env.DEPLOY_TARGET !== "staging") return new Response(null, { status: 404 });

  const token = env.PHASE13_STAGING_PROBE_TOKEN;
  if (!token || token.length < 32 || !tokenMatches(request.headers.get("x-phase13-probe-token"), token)) {
    return Response.json({ error: "Probe staging tidak diizinkan." }, { status: 401 });
  }

  if (env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_SUPABASE || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Binding server staging tidak valid." }, { status: 503 });
  }

  let authResponse: Response;
  try {
    authResponse = await fetcher(STAGING_SUPABASE + "/auth/v1/admin/users?page=1&per_page=1", {
      method: "GET",
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return Response.json({ error: "Auth staging tidak terjangkau." }, { status: 503 });
  }

  if (!authResponse.ok) {
    await authResponse.body?.cancel();
    return Response.json({ error: "Service key staging ditolak." }, { status: 503 });
  }
  const auth = await authResponse.json().catch(() => null);
  if (!Array.isArray(auth?.users) || !Number.isSafeInteger(auth?.total)) {
    return Response.json({ error: "Respons Auth staging tidak valid." }, { status: 503 });
  }

  return Response.json({ deploymentTarget: "staging", supabaseOrigin: STAGING_SUPABASE,
    serverRuntimeBinding: "passed", authAdminProbe: "passed" }, { headers: { "cache-control": "no-store" } });
}
