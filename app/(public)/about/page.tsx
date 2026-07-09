import { getLandingPageSettings } from "@/features/cms/queries";
﻿import { Award, ShieldCheck, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const { data: dbSettings } = await getLandingPageSettings();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-10">
      <div className="text-center">
        <p className="text-sm font-bold uppercase text-teal-700">Tentang Kami</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">Utero Academy</h1>
        <p className="mt-4 max-w-2xl mx-auto leading-relaxed text-slate-600">
          Utero Academy adalah lembaga pendidikan terpadu dan pelatihan kompetensi kerja di bawah naungan PT Utero Kreatif Indonesia.
        </p>
      </div>

      <div className="surface p-6 bg-white border border-slate-200 rounded-xl leading-relaxed text-slate-750 text-sm">
        {dbSettings?.about_text ? (
          <p className="whitespace-pre-wrap">{dbSettings.about_text}</p>
        ) : (
          <div className="space-y-4">
            <p>
              Kami berfokus pada pengembangan keterampilan praktis industri kreatif, teknologi digital, dan manajemen bisnis. Dengan kurikulum yang berorientasi pada kebutuhan pasar kerja serta didukung oleh praktisi profesional yang berpengalaman, kami berkomitmen untuk melahirkan lulusan-lulusan yang kompeten, berdaya saing tinggi, dan memiliki karakter moral yang kuat.
            </p>
            <p>
              Program magang industri di Utero Academy didesain secara komprehensif, mencakup modul-modul pelatihan berkala, kuis, evaluasi tugas praktis, serta proyek riil di dunia industri kreatif.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="surface p-5 bg-white border border-slate-200 rounded-xl text-center space-y-2">
          <Award className="mx-auto text-teal-600" size={32} />
          <h3 className="font-extrabold text-sm text-slate-900">Kurikulum Industri</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Materi pembelajaran dikembangkan langsung berdasarkan standar kompetensi industri terkini.
          </p>
        </div>
        <div className="surface p-5 bg-white border border-slate-200 rounded-xl text-center space-y-2">
          <ShieldCheck className="mx-auto text-teal-600" size={32} />
          <h3 className="font-extrabold text-sm text-slate-900">Sertifikasi Resmi</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Setiap lulusan magang yang berhasil menyelesaikan program akan dianugerahi sertifikat resmi kelulusan.
          </p>
        </div>
        <div className="surface p-5 bg-white border border-slate-200 rounded-xl text-center space-y-2">
          <Heart className="mx-auto text-teal-600" size={32} />
          <h3 className="font-extrabold text-sm text-slate-900">Bimbingan Mentor</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Siswa dibimbing secara langsung oleh praktisi kreatif dan administrator pembimbing profesional.
          </p>
        </div>
      </div>
    </main>
  );
}
