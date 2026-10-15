import { backendRequest, usesLocalBackend } from "@/lib/backend/server";
import { RouteAuthorizationError, requireRouteUser } from "@/features/auth/guards";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ bucket: string; path: string[] }> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest, context: Context) {
  if (!usesLocalBackend()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { bucket, path } = await context.params;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(bucket) || !path.length) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }
  const publicBuckets = new Set(["gallery", "article", "mentor", "school-logo"]);
  const knownBuckets = new Set(["avatars", "academy-private", "selection-answers", "daily-report", "task", "certificate", "learning", ...publicBuckets]);
  if (!knownBuckets.has(bucket)) return NextResponse.json({ error: "bucket_not_found" }, { status: 404 });
  const objectPath = path.map(encodeURIComponent).join("/");
  const token = request.nextUrl.searchParams.get("token");
  if (!publicBuckets.has(bucket) && !token) {
    try { await requireRouteUser(); }
    catch (error) {
      if (error instanceof RouteAuthorizationError) return NextResponse.json({ error: "authentication_required" }, { status: error.status });
      throw error;
    }
  }
  const upstreamPath = `/v1/storage/${encodeURIComponent(bucket)}/${objectPath}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const upstream = await backendRequest(upstreamPath);
  if (!upstream.body) return new NextResponse(null, { status: upstream.status });
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", token ? "private, no-store" : "public, max-age=300");
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
