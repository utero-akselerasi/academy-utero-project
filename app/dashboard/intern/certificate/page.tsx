import { getInternCertificate } from "@/features/assessments/queries";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { createSupabaseServerClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Award, Printer, ShieldAlert, Award as CertIcon, ClipboardCheck } from "lucide-react";
import { AlumniTestimonialForm } from "@/features/cms/AlumniTestimonialForm";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export default async function InternCertificatePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="surface p-6 text-sm font-semibold text-red-700">
          Profil peserta belum ditemukan.
        </div>
      </main>
    );
  }

  // Fetch intern profile, default site and existing testimonial
  const db = await createUteroAcademyServiceRoleClient();
  const { data: internProfile } = await db
    .from("intern_profiles")
    .select("status, full_name, major, school_id")
    .eq("id", internProfileId)
    .maybeSingle();

  const { data: defaultSite } = await db
    .from("cms_sites")
    .select("id")
    .eq("slug", "utero-academy")
    .maybeSingle();

  const { data: existingTestimonial } = await db
    .from("testimonials")
    .select("id, quote, status")
    .eq("intern_id", internProfileId)
    .maybeSingle();

  const { data: cert, error } = await getInternCertificate(internProfileId);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div>
        <p className="text-sm font-bold uppercase text-teal-700">Peserta Magang</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Sertifikat & Penilaian Akhir</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Tinjau penilaian kelulusan akhir Anda dan unduh sertifikat resmi Utero Academy yang diterbitkan oleh pembimbing.
        </p>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700">
          Gagal memuat sertifikat. Cek koneksi database.
        </div>
      ) : null}

      {!cert || cert.status !== "issued" ? (
        <div className="surface p-12 text-center border border-amber-200 bg-amber-50/50 rounded-xl space-y-3">
          <ShieldAlert className="mx-auto text-amber-500 mb-2" size={44} />
          <h2 className="text-xl font-bold text-amber-950">Sertifikat Belum Diterbitkan</h2>
          <p className="text-sm text-amber-700 max-w-md mx-auto leading-relaxed">
            Evaluasi penilaian akhir Anda sedang dalam proses oleh admin/pembimbing. Sertifikat resmi akan otomatis muncul di sini setelah pembimbing melakukan finalisasi penilaian.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
          {/* Kiri: Rekap Nilai Evaluasi */}
          <div className="surface p-6 bg-white border border-slate-200 rounded-xl space-y-6">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <ClipboardCheck size={20} className="text-teal-700" />
              <span>Transkrip Nilai Evaluasi</span>
            </h3>

            {/* Aspek-Aspek Nilai */}
            <div className="space-y-4">
              {[
                { label: "1. Nilai Keterampilan Teknis (Hard Skill)", value: cert.assessment.score?.technical || 0 },
                { label: "2. Nilai Kedisiplinan & Kehadiran", value: cert.assessment.score?.discipline || 0 },
                { label: "3. Nilai Sikap & Kerja Sama (Soft Skill)", value: cert.assessment.score?.attitude || 0 }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{item.label}</span>
                    <span className="text-slate-900">{item.value} / 100</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: item.value + "%" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Catatan Pembimbing */}
            {cert.assessment.feedback && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Feedback & Catatan Pembimbing</h4>
                <p className="text-xs text-slate-600 leading-relaxed italic whitespace-pre-wrap">
                  "{cert.assessment.feedback}"
                </p>
              </div>
            )}
          </div>

          {/* Kanan: Ringkasan Nilai Akhir & Tombol Unduh */}
          <div className="space-y-6">
            {/* Box Nilai Rata-Rata */}
            <div className="surface p-6 bg-white border border-slate-200 rounded-xl text-center space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nilai Akhir Rata-rata</span>
              <span className="text-5xl font-black text-teal-700 block">
                {cert.assessment.final_score}
              </span>
              <span className="text-xs font-bold px-3 py-1 rounded bg-teal-50 border border-teal-200 text-teal-800 uppercase inline-block">
                Lulus Program
              </span>
            </div>

            {/* Box Sertifikat Resmi */}
            <div className="surface p-6 bg-slate-900 text-white rounded-xl text-center space-y-4 shadow-lg border border-slate-800">
              <CertIcon className="mx-auto text-teal-400 animate-bounce" size={44} />
              <div>
                <h4 className="text-sm font-black tracking-wide uppercase text-teal-400">Sertifikat Magang</h4>
                <span className="text-[10px] font-mono text-slate-400 block mt-1">No: {cert.certificate_number}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Diterbitkan: {formatDate(cert.issued_at)}</span>
              </div>
              
              <Link
                href={`/dashboard/intern/certificate/print`}
                target="_blank"
                className="button-primary w-full text-center flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 font-bold"
              >
                <Printer size={16} />
                <span>Cetak Sertifikat PDF</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {internProfile?.status === "completed" && defaultSite && (
        <AlumniTestimonialForm siteId={defaultSite.id} existingTestimonial={existingTestimonial} />
      )}
    </main>
  );
}
