import { getMentorSubmissions, getAllCourses } from "@/features/lms/queries";
import { getMentorProfileId } from "@/features/daily-reports/queries";
import { gradeAssignmentAction } from "@/features/lms/actions";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Award, Eye, X, Check, Search, Calendar, ExternalLink, BookOpen, ArrowRight } from "lucide-react";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

function isImageAttachment(path: string | null) {
  if (!path) return false;
  const ext = path.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

type PageProps = {
  searchParams: Promise<{ detailSubId?: string; status?: string; q?: string }>;
};

export default async function MentorLmsPage({ searchParams }: PageProps) {
  const { detailSubId, status: statusFilter = "all", q: searchQuery = "" } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mentorProfileId = await getMentorProfileId(user.id);
  if (!mentorProfileId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil mentor/admin belum ditemukan. Hubungi admin untuk setup profil.
        </div>
      </main>
    );
  }

  const { data: submissions, error } = await getMentorSubmissions(mentorProfileId);
  const { data: courses } = await getAllCourses();

  // Filter submissions berdasarkan nama anak magang & status penilaian
  const filtered = submissions.filter(s => {
    const matchName = s.intern_name.toLowerCase().includes(searchQuery.toLowerCase());
    const isGraded = s.score !== null;
    const matchStatus = statusFilter === "all"
      ? true
      : statusFilter === "pending"
      ? !isGraded
      : isGraded;
    return matchName && matchStatus;
  });

  const pendingCount = submissions.filter(s => s.score === null).length;
  const detailSub = detailSubId ? submissions.find(s => s.id === detailSubId) : undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Admin / Pembimbing</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">LMS & Penilaian Tugas</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Kelola kelas pembelajaran, tambah materi/tugas baru, serta tinjau pengerjaan tugas peserta magang.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="status-pill">{submissions.length} tugas dikumpulkan</span>
          {pendingCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 animate-pulse">
              {pendingCount} butuh nilai
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat tugas kelas. Cek koneksi database.
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.8fr]">
        {/* Kiri: Daftar Kursus/Kelas */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950 flex items-center gap-2">
            <BookOpen size={18} className="text-teal-700" />
            <span>Manajemen Modul Kelas (" + courses.length + ")</span>
          </h2>
          <div className="grid gap-3">
            {courses.length === 0 ? (
              <div className="surface p-6 text-center text-slate-500 text-sm">
                Belum ada kelas kursus yang dibuat.
              </div>
            ) : (
              courses.map(c => (
                <div key={c.id} className="surface p-5 bg-white hover:border-teal-500 transition-all flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-950 text-lg leading-snug">{c.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.description || "Tidak ada deskripsi."}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-50 border border-teal-200 text-teal-800">
                      {c.status}
                    </span>
                    <Link
                      href={"/dashboard/mentor/lms/" + c.id}
                      className="button-secondary text-xs font-bold py-1 px-3 min-h-0 flex items-center gap-1"
                    >
                      Kelola Materi <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Kanan: Penilaian Tugas */}
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-950">
              Evaluasi Pengumpulan Tugas (" + filtered.length + ")
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs">
              {[
                { label: "Semua", value: "all" },
                { label: "Butuh Nilai", value: "pending" },
                { label: "Sudah Dinilai", value: "graded" }
              ].map(tab => (
                <Link
                  key={tab.value}
                  href={"/dashboard/mentor/lms?status=" + tab.value + "&q=" + searchQuery}
                  className={"px-2.5 py-1 rounded-md font-semibold transition-all " + (
                    statusFilter === tab.value
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-950"
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <form className="relative w-full">
              <input type="hidden" name="status" value={statusFilter} />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={15} className="text-slate-400" />
              </div>
              <input
                className="form-input pl-10"
                name="q"
                defaultValue={searchQuery}
                placeholder="Cari nama peserta magang..."
              />
            </form>
          </div>

          <div className="grid gap-2">
            {filtered.map((sub) => (
              <div key={sub.id} className="surface p-3 bg-white hover:border-teal-500 transition-all flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold block">Dikumpulkan: {formatDate(sub.submitted_at)}</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                    <span className="text-teal-700 font-black mr-1">{sub.intern_name}</span>
                    <span>- {sub.assignment_title}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sub.score !== null ? (
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                      Skor: {sub.score}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Belum Dinilai
                    </span>
                  )}
                  <Link
                    href={"/dashboard/mentor/lms?status=" + statusFilter + "&q=" + searchQuery + "&detailSubId=" + sub.id}
                    className="button-secondary p-1.5 min-h-0 text-slate-600 hover:bg-slate-100"
                  >
                    <Eye size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* POPUP MODAL PENILAIAN TUGAS */}
      {detailSub ? (
        (() => {
          const isImg = isImageAttachment(detailSub.attachment_path);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Penilaian Tugas</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Siswa: <strong className="text-teal-700">{detailSub.intern_name}</strong> | Tugas: <strong className="text-slate-700">\"${detailSub.assignment_title}\"</strong>
                    </p>
                  </div>
                  <Link
                    href={"/dashboard/mentor/lms?status=" + statusFilter + "&q=" + searchQuery}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                  >
                    <X size={18} />
                  </Link>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-950">Jawaban Tulis / Tautan Kerja</h4>
                    <p className="mt-1.5 text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                      {detailSub.content || "Siswa tidak menuliskan teks jawaban."}
                    </p>
                  </div>

                  {detailSub.attachment_path && (
                    <div>
                      <h4 className="text-sm font-black text-slate-950 mb-2">Lampiran File Tugas</h4>
                      {isImg ? (
                        <div className="max-w-xs">
                          <ImagePreview src={detailSub.attachment_path} alt="Bukti Tugas" className="max-h-36 w-auto object-contain mx-auto" />
                        </div>
                      ) : (
                        <a
                          href={detailSub.attachment_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button-secondary text-xs text-teal-700 border-teal-200 hover:bg-teal-50 font-bold flex items-center gap-1.5 w-fit py-1.5 px-3 min-h-0"
                        >
                          <ExternalLink size={14} /> Unduh File Lampiran Tugas
                        </a>
                      )}
                    </div>
                  )}

                  <form action={gradeAssignmentAction} className="border-t border-slate-200 pt-4 space-y-4">
                    <input type="hidden" name="submissionId" value={detailSub.id} />
                    <h4 className="text-sm font-black text-slate-950">Penilaian & Feedback</h4>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="form-field sm:col-span-1">
                        <label className="form-label text-xs" htmlFor="score">Nilai Tugas (0 - 100) *</label>
                        <input
                          type="number"
                          id="score"
                          name="score"
                          min="0"
                          max="100"
                          required
                          className="form-input text-sm font-bold text-teal-700 bg-teal-50/20"
                          defaultValue={detailSub.score !== null ? String(detailSub.score) : ""}
                          placeholder="Contoh: 85"
                        />
                      </div>

                      <div className="form-field sm:col-span-2">
                        <label className="form-label text-xs" htmlFor="feedback">Catatan Masukan / Feedback</label>
                        <textarea
                          id="feedback"
                          name="feedback"
                          rows={2}
                          className="form-input text-xs"
                          defaultValue={detailSub.feedback || ""}
                          placeholder="Tulis saran..."
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="button-primary font-bold text-xs py-2 w-full flex items-center justify-center gap-1 min-h-0"
                    >
                      <Check size={14} />
                      <span>Simpan Penilaian</span>
                    </button>
                  </form>
                </div>

                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
                  <Link
                    href={"/dashboard/mentor/lms?status=" + statusFilter + "&q=" + searchQuery}
                    className="button-secondary text-sm font-semibold"
                  >
                    Tutup
                  </Link>
                </div>
              </div>
            </div>
          );
        })()
      ) : null}
    </main>
  );
}
