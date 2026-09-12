import { ArticleAddons } from "@/features/public/article-addons/ArticleAddons";
import { normalizeArticleAddons } from "@/features/public/article-addons/normalize";
import { artikelApiConfigured, getArtikelArticle } from "@/lib/artikel/api";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User } from "lucide-react";
import Link from "next/link";

type Props = { params: Promise<{ slug: string }> };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  let article: any;
  let authorName = "Admin Utero";

  if (artikelApiConfigured()) {
    article = await getArtikelArticle(slug);
  } else {
    const db = await createUteroAcademyServiceRoleClient();
    const result = await db.from("articles").select("id, title, content, cover_path, created_at, author_id").eq("slug", slug).eq("status", "published").maybeSingle();
    article = result.data;
    if (article?.author_id) {
      const { data: author } = await db.from("user_profiles").select("full_name").eq("id", article.author_id).maybeSingle();
      authorName = author?.full_name || authorName;
    }
  }

  if (!article) notFound();

  const body = typeof article.content === "string" ? article.content : article.content?.text || "";
  const addons = article.addons?.length ? normalizeArticleAddons(article.addons) : normalizeArticleAddons(article.content);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <div className="mb-4"><Link href="/blog" className="button-secondary text-xs flex items-center gap-1.5 w-fit border border-slate-200"><ArrowLeft size={14} /> Kembali ke Blog</Link></div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center text-xs text-slate-400 font-bold">
          <span className="flex items-center gap-1"><Calendar size={12} /><span>{formatDate(article.published_at || article.created_at)}</span></span>
          <span className="flex items-center gap-1"><User size={12} /><span>{authorName}</span></span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-950 leading-tight">{article.title}</h1>
      </div>
      {article.cover_path && <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={article.cover_path} alt={article.title} className="w-full h-auto max-h-[450px] object-cover mx-auto" /></div>}
      <ArticleAddons addons={addons} placement="before_content" />
      <article className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed pt-4">
        {typeof body === "string" && body.trim().startsWith("<") ? <div dangerouslySetInnerHTML={{ __html: body }} /> : <div className="whitespace-pre-wrap">{body}</div>}
      </article>
      <ArticleAddons addons={addons} placement="after_content" />
    </main>
  );
}
