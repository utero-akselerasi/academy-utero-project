import { ArticleAddons } from "@/features/public/article-addons/ArticleAddons";
import { normalizeArticleAddons } from "@/features/public/article-addons/normalize";
import { artikelApiSelected, getArtikelArticle } from "@/lib/artikel/api";
import { resolveStorageUrl } from "@/lib/storage-urls";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User } from "lucide-react";
import Link from "next/link";
import { usesLocalBackend } from "@/lib/backend/server";
import { formatArticleContent } from "@/lib/artikel/content";

type Props = { params: Promise<{ slug: string }> };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  let article: any;
  let authorName = "Admin Utero";

  if (artikelApiSelected()) {
    article = await getArtikelArticle(slug);
  } else if (usesLocalBackend()) {
    article = await getArtikelArticle(slug);
    authorName = article?.author_name || authorName;
  } else {
    const db = await createUteroAcademyServiceRoleClient();
    const result = await db.from("articles").select("id, title, content, cover_path, created_at, author_id").eq("slug", slug).eq("status", "published").maybeSingle();
    article = result.data;
    if (article) {
      // Halaman ini punya kueri sendiri, bukan lewat `getCmsData()`, jadi
      // resolusi `cover_path` harus diulang di sini.
      //
      // Hanya di cabang DB. Cabang `artikelApiConfigured()` di atas mengembalikan
      // URL dari `cms.carubra.com` — bucket asing yang `toObjectPath` justru
      // memetakan ke `null`, jadi menyentuhnya akan menghapus gambar artikel
      // eksternal.
      article.cover_path = await resolveStorageUrl("article", article.cover_path);
    }
    if (article?.author_id) {
      const { data: author } = await db.from("user_profiles").select("full_name").eq("id", article.author_id).maybeSingle();
      authorName = author?.full_name || authorName;
    }
  }

  if (!article) notFound();

  const body = typeof article.content === "string" ? article.content : article.content?.text || "";
  const addons = article.addons?.length ? normalizeArticleAddons(article.addons) : normalizeArticleAddons(article.content);
  const richBody = typeof body === "string" && body.trim().startsWith("<") ? formatArticleContent(body, article.title) : null;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/blog" className="button-secondary w-fit gap-2 text-sm"><ArrowLeft aria-hidden="true" size={16} /> Kembali ke Blog</Link>

      <header className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        {article.category?.name ? <p className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-700">{article.category.name}</p> : null}
        <h1 className="text-3xl font-black leading-[1.15] tracking-tight text-slate-950 sm:text-4xl md:text-5xl">{article.title}</h1>
        {article.excerpt ? <p className="max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{article.excerpt}</p> : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-500">
          <span className="flex items-center gap-2"><Calendar aria-hidden="true" size={15} /><span>{formatDate(article.published_at || article.created_at)}</span></span>
          <span className="flex items-center gap-2"><User aria-hidden="true" size={15} /><span>{authorName}</span></span>
        </div>
      </header>

      {article.cover_path ? <figure className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm"><img src={article.cover_path} alt={article.title} className="max-h-[520px] w-full object-cover" /></figure> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9 md:p-12">
        <ArticleAddons addons={addons} placement="before_content" />
        <article className="article-content">
          {richBody !== null ? <div dangerouslySetInnerHTML={{ __html: richBody }} /> : <div className="whitespace-pre-wrap">{body}</div>}
        </article>
        <ArticleAddons addons={addons} placement="after_content" />
      </section>
    </main>
  );
}
