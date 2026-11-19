import { NextResponse } from "next/server";
import { ArtikelApiError, getArtikelArticle } from "@/lib/artikel/api";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { const article = await getArtikelArticle((await params).slug); if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 }); return NextResponse.json({ data: article }); }
  catch (error) {
    const rateLimited = error instanceof ArtikelApiError && error.status === 429;
    const headers = rateLimited && error.retryAfterSeconds !== undefined ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
    return NextResponse.json({ error: "Gagal memuat artikel." }, { status: rateLimited ? 429 : 502, headers });
  }
}
