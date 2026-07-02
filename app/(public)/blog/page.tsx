import { getCmsData } from "@/features/cms/queries";
import { Newspaper, ArrowRight, Calendar } from "lucide-react";
import Link from "next/link";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function BlogListPage() {
  const siteId = "c6e8f645-5f5e-4b33-a66a-bf92e047c212";
  let articles: any[] = [];

  try {
    const res = await getCmsData(siteId);
    if (res && res.articles) {
      articles = res.articles.filter(a => a.status === "published");
    }
  } catch (err) {
    console.error("Gagal memuat artikel blog:", err);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <div>
        <p className="text-sm font-bold uppercase text-teal-700">Berita & Informasi</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">Blog Utero Academy</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-slate-600">
          Ikuti kabar, tutorial, kegiatan harian, dan informasi penting terbaru seputar dunia kreatif dan magang.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {articles.length === 0 ? (
          <div className="surface p-8 text-center text-slate-500 col-span-full">
            Belum ada artikel yang diterbitkan.
          </div>
        ) : (
          articles.map((art) => (
            <article key={art.id} className="surface bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                {art.cover_path ? (
                  <img src={art.cover_path} alt={art.title} className="w-full h-48 object-cover border-b border-slate-100" />
                ) : (
                  <div className="w-full h-48 bg-slate-100 border-b border-slate-100 flex items-center justify-center text-slate-400">
                    <Newspaper size={44} />
                  </div>
                )}
                <div className="p-5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                    <Calendar size={12} />
                    <span>{formatDate(art.created_at)}</span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg leading-snug line-clamp-2">{art.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{art.excerpt || "Tidak ada deskripsi singkat."}</p>
                </div>
              </div>
              <div className="p-5 pt-0">
                <Link href={'/blog/' + art.slug} className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1">
                  <span>Baca Selengkapnya</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
