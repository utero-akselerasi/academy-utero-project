import { getLandingPageSettings } from "@/features/cms/queries";
﻿export default async function TermsPage() {
  const { data: dbSettings } = await getLandingPageSettings();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div>
        <p className="text-sm font-bold uppercase text-teal-700">Legalitas</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">Syarat & Ketentuan</h1>
        <p className="mt-2 text-slate-500 text-xs">Pembaruan terakhir: 1 Juli 2026</p>
      </div>

      {dbSettings?.terms_content ? (
        <div className="surface p-6 bg-white border border-slate-200 rounded-xl leading-relaxed text-slate-750 text-sm whitespace-pre-wrap">
          {dbSettings.terms_content}
        </div>
      ) : (
        <div className="surface p-6 bg-white border border-slate-200 rounded-xl leading-relaxed text-slate-700 text-xs space-y-6">
          <section className="space-y-2">
            <h2 className="font-extrabold text-sm text-slate-950">1. Persyaratan Pendaftaran</h2>
            <p>
              Peserta yang mendaftar ke program magang Utero Academy wajib memberikan informasi pendaftaran yang benar, akurat, dan lengkap sesuai dengan kartu identitas atau berkas akademis yang sah.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-sm text-slate-950">2. Kewajiban & Disiplin Magang</h2>
            <p>
              Anak magang wajib mematuhi seluruh tata tertib kehadiran, jam masuk kerja, check-in absensi geofencing, serta pengiriman daily report harian secara disiplin sesuai dengan instruksi mentor pembimbing.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-sm text-slate-950">3. Hak Kekayaan Intelektual</h2>
            <p>
              Seluruh hasil karya desain, aset digital, source code, dan materi proyek yang dikembangkan selama masa bakti magang di Utero Academy sepenuhnya menjadi hak milik intelektual PT Utero Kreatif Indonesia.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-sm text-slate-950">4. Kriteria Kelulusan & Sertifikat</h2>
            <p>
              Sertifikat Kelulusan Resmi hanya akan diterbitkan setelah peserta menyelesaikan seluruh target jam bimbingan bulanan, lulus evaluasi kuis LMS, serta mendapatkan finalisasi penilaian minimal (KKM) dari pembimbing.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
