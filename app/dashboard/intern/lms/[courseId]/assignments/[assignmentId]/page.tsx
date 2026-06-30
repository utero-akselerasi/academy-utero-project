import { getAssignment } from "@/features/lms/queries";
import { submitAssignmentAction } from "@/features/lms/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Calendar, UploadCloud, CheckCircle2, MessageSquare, AlertCircle } from "lucide-react";

type Props = {
  params: Promise<{ courseId: string; assignmentId: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}

export default async function InternAssignmentPage({ params }: Props) {
  const { courseId, assignmentId } = await params;

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

  const { data: assignment, error } = await getAssignment(assignmentId, profile.id);

  if (error || !assignment) {
    notFound();
  }

  const sub = assignment.submission;
  const isSubmitted = !!sub;
  const isGraded = sub && sub.score !== null;

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

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Kiri: Detail Tugas & Form Pengumpulan */}
        <div className="surface p-6 bg-white border border-slate-200 rounded-xl space-y-6">
          <div>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 uppercase">
              Tugas Praktis Kelas
            </span>
            <h1 className="text-2xl font-black text-slate-950 mt-1 leading-snug">{assignment.title}</h1>
            {assignment.due_at && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold mt-2">
                <Calendar size={13} />
                <span>Deadline: {formatDate(assignment.due_at)}</span>
              </div>
            )}
          </div>

          <article className="prose max-w-none text-slate-700 text-sm leading-8 bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
            <h3 className="font-bold text-slate-950 flex items-center gap-2 mb-2 border-b border-slate-200 pb-2">
              <FileText size={16} className="text-teal-700" />
              <span>Instruksi Tugas</span>
            </h3>
            {assignment.description || "Tidak ada instruksi khusus."}
          </article>

          {/* Form Pengumpulan Tugas (Kumpulkan / Edit Pengumpulan) */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <h3 className="text-base font-bold text-slate-950">
              {isSubmitted ? "Edit Pengumpulan Tugas" : "Kumpulkan Tugas Baru"}
            </h3>

            <form action={submitAssignmentAction} className="space-y-4">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <input type="hidden" name="courseId" value={courseId} />

              <div className="form-field">
                <label className="form-label" htmlFor="content">Jawaban Tulis / Link Figma</label>
                <textarea
                  className="form-input"
                  id="content"
                  name="content"
                  placeholder="Tuliskan jawaban Anda atau link pengerjaan di sini..."
                  rows={4}
                  defaultValue={sub?.content || ""}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Unggah Bukti Berkas (PDF / Gambar - Maks 10MB)</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-teal-500 bg-slate-50/50">
                  <UploadCloud size={20} className="text-slate-400" />
                  <span className="text-xs text-slate-600 font-bold">Pilih file bukti...</span>
                  <input
                    name="attachment"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                </label>
                {sub?.attachment_path && (
                  <p className="text-xs text-slate-500 mt-2 font-semibold">
                    File saat ini: <a href={sub.attachment_path} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline">Lihat Lampiran</a>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="button-primary font-bold px-5 py-2 w-full flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>{isSubmitted ? "Simpan Perubahan Tugas" : "Kumpulkan Tugas"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Kanan: Info Status Pengumpulan */}
        <div className="space-y-6">
          <div className="surface p-5 bg-white border border-slate-200 rounded-xl space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <CheckCircle2 size={18} className="text-teal-700" />
              <span>Status Tugas</span>
            </h3>

            <div className="space-y-4">
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Status Pengumpulan</span>
                {isGraded ? (
                  <>
                    <span className="text-4xl font-black text-teal-600 block">{sub.score}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded border inline-block bg-teal-50 border-teal-200 text-teal-800 uppercase">
                      Sudah Dinilai
                    </span>
                  </>
                ) : isSubmitted ? (
                  <>
                    <span className="text-2xl font-black text-amber-700 block">Menunggu</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded border inline-block bg-amber-50 border-amber-200 text-amber-800 uppercase">
                      Sudah Dikumpulkan
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-red-600 block">Belum</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded border inline-block bg-red-50 border-red-200 text-red-800 uppercase">
                      Belum Dikumpulkan
                    </span>
                  </>
                )}
              </div>

              {/* Umpan Balik Mentor */}
              {isGraded && sub.feedback && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1">
                    <MessageSquare size={13} className="text-teal-700" />
                    <span>Catatan Review Mentor</span>
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed italic whitespace-pre-wrap">
                    "{sub.feedback}"
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold block pt-1 border-t border-slate-100 mt-1">
                    Dinilai: {formatDate(sub.reviewed_at!)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
