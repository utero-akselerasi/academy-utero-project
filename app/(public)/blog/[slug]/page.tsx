import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User } from "lucide-react";
import Link from "next/link";

type Props = {
  params: Promise<{ slug: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export const dynamic = "force-dynamic";

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  const db = await createUteroAcademyServiceRoleClient();

  const { data: article } = await db
    .from("articles")
    .select("id, title, content, cover_path, created_at, author_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) {
    notFound();
  }

  // Fetch author profile
  const { data: author } = await db
    .from("user_profiles")
    .select("full_name")
    .eq("id", article.author_id)
    .maybeSingle();

  const authorName = author?.full_name || "Admin Utero";
  const bodyText = (article.content as any)?.text || "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <div className="mb-4">
        <Link href="/blog" className="button-secondary text-xs flex items-center gap-1.5 w-fit border border-slate-200">
          <ArrowLeft size={14} /> Kembali ke Blog
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center text-xs text-slate-400 font-bold">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            <span>{formatDate(article.created_at)}</span>
          </span>
          <span className="flex items-center gap-1">
            <User size={12} />
            <span>{authorName}</span>
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-950 leading-tight">
          {article.title}
        </h1>
      </div>

      {article.cover_path && (
        <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img src={article.cover_path} alt={article.title} className="w-full h-auto max-h-[450px] object-cover mx-auto" />
        </div>
      )}

      <article className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed whitespace-pre-wrap pt-4">
        {bodyText}
      </article>
    </main>
  );
}
