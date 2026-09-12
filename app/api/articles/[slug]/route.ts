import { NextResponse } from "next/server";
import { getArtikelArticle } from "@/lib/artikel/api";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { const article = await getArtikelArticle((await params).slug); if (!article) return NextResponse.json({ error: "Artikel tidak ditemukan." }, { status: 404 }); return NextResponse.json({ data: article }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat artikel." }, { status: 502 }); }
}
