import { getCmsData } from "@/features/cms/queries";
import { artikelApiConfigured, getArtikelArticles } from "@/lib/artikel/api";
import { Newspaper, ArrowRight, Calendar } from "lucide-react";
import Link from "next/link";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function BlogListPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const siteId = "c6e8f645-5f5e-4b33-a66a-bf92e047c212";
  const query = await searchParams;
  const requestedPage = Number(query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let articles: any[] = [];
  let total = 0;
  let limit = 10;
  let loadFailed = false;

  try {
    if (artikelApiConfigured()) {
      const result = await getArtikelArticles({ category: query.category, page, limit });
      articles = result.articles;
      total = result.meta.total;
      limit = result.meta.limit;
    } else {
      const result = await getCmsData(siteId);
      articles = result?.articles?.filter((article) => article.status === "published") || [];
    }
  } catch (error) {
    loadFailed = true;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <div>
        <p className="text-sm font-bold uppercase text-teal-700">Berita & Informasi</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">Blog Utero Academy</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-slate-600">Ikuti kabar, tutorial, kegiatan harian, dan informasi penting terbaru seputar dunia kreatif dan magang.</p>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {articles.length === 0 ? (
          <div className="surface p-8 text-center text-slate-500 col-span-full">{loadFailed ? "Artikel belum dapat dimuat. Silakan coba kembali nanti." : "Belum ada artikel yang diterbitkan."}</div>
        ) : articles.map((article) => (
          <article key={article.id} className="surface bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              {article.cover_path ? <img src={article.cover_path} alt={article.title} className="w-full h-48 object-cover border-b border-slate-100" /> : <div className="w-full h-48 bg-slate-100 border-b border-slate-100 flex items-center justify-center text-slate-400"><Newspaper size={44} /></div>}
              <div className="p-5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold"><Calendar size={12} /><span>{formatDate(article.published_at || article.created_at)}</span></div>
                <h3 className="font-extrabold text-slate-900 text-lg leading-snug line-clamp-2">{article.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{article.excerpt || "Tidak ada deskripsi singkat."}</p>
              </div>
            </div>
            <div className="p-5 pt-0"><Link href={`/blog/${article.slug}`} className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"><span>Baca Selengkapnya</span><ArrowRight size={12} /></Link></div>
          </article>
        ))}
      </div>
      {total > limit && (
        <nav className="flex items-center justify-center gap-3" aria-label="Pagination blog">
          {page > 1 && <Link href={`/blog?page=${page - 1}${query.category ? `&category=${encodeURIComponent(query.category)}` : ""}`} className="button-secondary text-xs">Sebelumnya</Link>}
          <span className="text-xs font-bold text-slate-500">Halaman {page} dari {Math.ceil(total / limit)}</span>
          {page * limit < total && <Link href={`/blog?page=${page + 1}${query.category ? `&category=${encodeURIComponent(query.category)}` : ""}`} className="button-secondary text-xs">Berikutnya</Link>}
        </nav>
      )}
    </main>
  );
}
