import { getMentorSubmissions, getAllCourses } from "@/features/lms/queries";
import { getMentorProfileId } from "@/features/daily-reports/queries";
import { gradeAssignmentAction, createCourseAction } from "@/features/lms/actions";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Award, Eye, X, Check, Search, Calendar, ExternalLink, BookOpen, ArrowRight, PlusCircle, Plus } from "lucide-react";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

function isImageAttachment(path: string | null) {
  if (!path) return false;
  const ext = path.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

type PageProps = {
  searchParams: Promise<{ detailSubId?: string; status?: string; q?: string; cQ?: string; showCreateCourse?: string }>;
};

export default async function MentorLmsPage({ searchParams }: PageProps) {
  const { detailSubId, status: statusFilter = "all", q: searchQuery = "", cQ: courseQuery = "", showCreateCourse } = await searchParams;

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

  // Filter courses berdasarkan pencarian modul/kelas
  const filteredCourses = (courses || []).filter(c => 
    c.title.toLowerCase().includes(courseQuery.toLowerCase()) ||
    (c.description || "").toLowerCase().includes(courseQuery.toLowerCase())
  );

  const pendingCount = submissions.filter(s => s.score === null).length;
  const detailSub = detailSubId ? submissions.find(s => s.id === detailSubId) : undefined;
  const isCreateCourseOpen = showCreateCourse === "true";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Admin / Pembimbing</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">LMS & Penilaian Tugas</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Kelola kelas pembelajaran, tambah materi/tugas baru, serta tinjau pengerjaan tugas peserta magang.
          </p>
        </div>
        
        {/* Tombol Tambah Kelas Baru */}
        <Link
          href={"/dashboard/mentor/lms?showCreateCourse=true&status=" + statusFilter + "&q=" + searchQuery}
          className="button-primary text-xs py-2 px-4 min-h-0 flex items-center gap-1.5 font-bold rounded-lg shrink-0 self-start md:self-center"
        >
          <PlusCircle size={15} />
          <span>Tambah Kelas Baru</span>
        </Link>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat tugas kelas. Cek koneksi database.
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Kiri: Daftar Kursus/Kelas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-250 pb-3">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <BookOpen size={18} className="text-teal-700" />
              <span>Manajemen Modul Kelas ({filteredCourses.length})</span>
            </h2>
          </div>

          {/* Form Pencarian Kelas / Module */}
          <form method="GET" action="/dashboard/mentor/lms" className="relative w-full">
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="q" value={searchQuery} />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-slate-400" />
            </div>
            <input
              className="form-input !pl-10 text-xs py-1.5 bg-white h-9"
              name="cQ"
              defaultValue={courseQuery}
              placeholder="Cari kelas / course..."
            />
          </form>

          {/* List Kelas Grid Card */}
          {filteredCourses.length === 0 ? (
            <div className="surface p-8 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-200">
              Tidak ditemukan kelas pembelajaran.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredCourses.map((c) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group">
                  <div className="space-y-2">
                    <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-150 shrink-0">
                      <BookOpen size={18} />
                    </div>
                    <h3 className="font-extrabold text-slate-900 group-hover:text-teal-700 transition-colors text-xs leading-tight">
                      {c.title}
                    </h3>
                    {c.description && (
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <Link
                      href={"/dashboard/mentor/lms/" + c.id}
                      className="button-secondary text-[10px] font-bold py-1.5 px-3 min-h-0 flex items-center gap-1 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300"
                    >
                      <span>Kelola Materi</span>
                      <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kanan: Penilaian Tugas */}
        <div className="space-y-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-950">
              Evaluasi Pengumpulan Tugas ({filtered.length})
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs w-fit">
              {[
                { label: "Semua", value: "all" },
                { label: "Butuh Nilai", value: "pending" },
                { label: "Sudah Dinilai", value: "graded" }
              ].map(tab => (
                <Link
                  key={tab.value}
                  href={"/dashboard/mentor/lms?status=" + tab.value + "&q=" + searchQuery + "&cQ=" + courseQuery}
                  className={"px-3 py-1.5 rounded-md font-bold transition-all text-center " + (
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
              <input type="hidden" name="cQ" value={courseQuery} />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={15} className="text-slate-400" />
              </div>
              <input
                className="form-input !pl-10"
                name="q"
                defaultValue={searchQuery}
                placeholder="Cari nama peserta magang..."
              />
            </form>
          </div>

          <div className="grid gap-2">
            {filtered.length === 0 ? (
              <div className="surface p-6 text-center text-slate-500 text-xs">
                Tidak ada pengumpulan tugas.
              </div>
            ) : (
              filtered.map((sub) => (
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
                      href={"/dashboard/mentor/lms?detailSubId=" + sub.id + "&status=" + statusFilter + "&q=" + searchQuery + "&cQ=" + courseQuery}
                      className="button-secondary p-1.5 min-h-0 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center"
                    >
                      <Eye size={13} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* POPUP MODAL TAMBAH KELAS BARU */}
      {isCreateCourseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-1.5">
                <PlusCircle size={16} className="text-teal-700" />
                <span>Tambah Kelas / Course Baru</span>
              </h3>
              <Link
                href={"/dashboard/mentor/lms?status=" + statusFilter + "&q=" + searchQuery + "&cQ=" + courseQuery}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </Link>
            </div>

            {/* Form */}
            <form action={createCourseAction} className="p-6 space-y-4">
              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700">Judul Kelas / Course *</label>
                <input
                  className="form-input text-sm"
                  name="title"
                  placeholder="Judul Kelas (misal: Dasar-dasar Design Graphic)"
                  required
                />
              </div>
              
              <div className="form-field">
                <label className="form-label text-xs font-bold text-slate-700">Deskripsi Kelas</label>
                <textarea
                  className="form-input text-xs"
                  name="description"
                  rows={3}
                  placeholder="Deskripsi singkat mengenai kelas..."
                />
              </div>
              
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <Link
                  href={"/dashboard/mentor/lms?status=" + statusFilter + "&q=" + searchQuery + "&cQ=" + courseQuery}
                  className="button-secondary text-sm font-semibold"
                >
                  Batal
                </Link>
                <button type="submit" className="button-primary text-sm font-bold flex items-center gap-1">
                  <Plus size={16} />
                  <span>Buat Kelas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP DETAIL PENILAIAN TUGAS */}
      {detailSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-black text-slate-900">Review Tugas Peserta</h3>
                <p className="text-xs text-slate-400 font-semibold">{detailSub.intern_name} - {detailSub.assignment_title}</p>
              </div>
              <Link
                href={"/dashboard/mentor/lms?status=" + statusFilter + "&q=" + searchQuery + "&cQ=" + courseQuery}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </Link>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Catatan Peserta</span>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {detailSub.content || "Tidak ada catatan."}
                </p>
              </div>

              {detailSub.attachment_path && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Bukti File Pengerjaan</span>
                  {isImageAttachment(detailSub.attachment_path) ? (
                    <ImagePreview src={detailSub.attachment_path} alt="File Tugas" />
                  ) : (
                    <a href={detailSub.attachment_path} target="_blank" rel="noopener noreferrer" className="button-secondary text-xs inline-flex items-center gap-1.5">
                      Unduh Lampiran Tugas
                    </a>
                  )}
                </div>
              )}

              {/* Form Input Nilai */}
              <div className="border-t border-slate-150 pt-4">
                <span className="text-[10px] text-slate-400 font-bold block uppercase mb-2">Penilaian Mentor</span>
                <form action={gradeAssignmentAction} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <input type="hidden" name="submissionId" value={detailSub.id} />
                  <div className="form-field">
                    <label className="form-label text-xs font-bold text-slate-700" htmlFor="scoreInput">Skor / Nilai (0-100) *</label>
                    <input
                      type="number"
                      id="scoreInput"
                      name="score"
                      className="form-input text-sm bg-white"
                      defaultValue={detailSub.score !== null ? detailSub.score : ""}
                      min="0"
                      max="100"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label text-xs font-bold text-slate-700" htmlFor="feedbackInput">Feedback Mentor</label>
                    <textarea
                      id="feedbackInput"
                      name="feedback"
                      className="form-input text-xs bg-white"
                      rows={2}
                      defaultValue={detailSub.feedback || ""}
                      placeholder="Tulis saran / feedback kualitatif untuk siswa..."
                    />
                  </div>
                  <button type="submit" className="button-primary text-xs py-2 w-full min-h-0 font-bold flex items-center justify-center gap-1">
                    <Check size={14} />
                    <span>Simpan Nilai & Selesai</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <Link
                href={"/dashboard/mentor/lms?status=" + statusFilter + "&q=" + searchQuery + "&cQ=" + courseQuery}
                className="button-secondary text-sm font-semibold"
              >
                Tutup
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
