import { NextResponse } from "next/server";
import { getArtikelArticles } from "@/lib/artikel/api";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const category = searchParams.get("category") || undefined;
  const page = Number(searchParams.get("page"));
  const limit = Number(searchParams.get("limit"));
  try {
    const result = await getArtikelArticles({ category, page, limit });
    return NextResponse.json({ data: result.articles, meta: result.meta });
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat artikel." }, { status: 502 }); }
}
