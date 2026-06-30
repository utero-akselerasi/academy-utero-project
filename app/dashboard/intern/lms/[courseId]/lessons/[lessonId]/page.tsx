import { getLesson } from "@/features/lms/queries";
import { markLessonCompletedAction } from "@/features/lms/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, PlayCircle, FileText } from "lucide-react";

type Props = {
  params: Promise<{ courseId: string; lessonId: string }>;
};

// Helper untuk mengekstrak youtube video ID dari url youtube
function getYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default async function InternLessonDetailPage({ params }: Props) {
  const { courseId, lessonId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .schema("utero_academy")
    .from("intern_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil peserta belum ditemukan.
        </div>
      </main>
    );
  }

  const { data: lesson, error } = await getLesson(lessonId, profile.id);

  if (error || !lesson) {
    notFound();
  }

  // Ambil teks konten dari jsonb
  const contentText = typeof lesson.content === "object" && lesson.content !== null
    ? (lesson.content as any).text || JSON.stringify(lesson.content)
    : String(lesson.content);

  const youtubeId = getYoutubeId(lesson.video_url);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Tombol Kembali */}
      <div className="mb-6">
        <Link
          href={`/dashboard/intern/lms/${courseId}`}
          className="button-secondary text-sm flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft size={16} /> Kembali ke Kelas
        </Link>
      </div>

      <div className="surface p-6 bg-white border border-slate-200 rounded-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 uppercase">
              Materi {lesson.order_index + 1}
            </span>
            <h1 className="text-2xl font-black text-slate-950 mt-1 leading-snug">{lesson.title}</h1>
          </div>
          {lesson.is_completed && (
            <div className="flex items-center gap-1 text-teal-600 font-bold text-sm bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
              <CheckCircle2 size={16} />
              <span>Selesai Dipelajari</span>
            </div>
          )}
        </div>

        {/* Video Player (YouTube) */}
        {youtubeId && (
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-md">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={lesson.title}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        )}

        {/* Materi Text Konten */}
        <article className="prose max-w-none text-slate-700 text-sm leading-8 whitespace-pre-wrap bg-slate-50/50 p-5 rounded-xl border border-slate-100">
          <h3 className="font-bold text-slate-950 flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
            <FileText size={16} className="text-teal-700" />
            <span>Materi Bacaan</span>
          </h3>
          {contentText}
        </article>

        {/* Tombol Mark Completed */}
        {!lesson.is_completed && (
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <form action={markLessonCompletedAction}>
              <input type="hidden" name="lessonId" value={lesson.id} />
              <input type="hidden" name="courseId" value={courseId} />
              <button
                type="submit"
                className="button-primary flex items-center gap-1.5 py-2 px-5 font-bold"
              >
                <CheckCircle2 size={18} /> Tandai Selesai & Lanjut
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
