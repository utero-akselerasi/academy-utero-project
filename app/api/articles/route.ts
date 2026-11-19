import { NextResponse } from "next/server";
import { ArtikelApiError, getArtikelArticles } from "@/lib/artikel/api";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const category = searchParams.get("category") || undefined;
  const page = Number(searchParams.get("page"));
  const limit = Number(searchParams.get("limit"));
  try {
    const result = await getArtikelArticles({ category, page, limit });
    return NextResponse.json({ data: result.articles, meta: result.meta });
  }
  catch (error) {
    const rateLimited = error instanceof ArtikelApiError && error.status === 429;
    const headers = rateLimited && error.retryAfterSeconds !== undefined ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
    return NextResponse.json({ error: "Gagal memuat artikel." }, { status: rateLimited ? 429 : 502, headers });
  }
}
