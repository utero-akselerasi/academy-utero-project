import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

const highlights = [
  {
    title: "Magang terstruktur",
    description:
      "Pendaftaran, seleksi, mentor, task, laporan harian, sampai assessment berada dalam satu alur.",
    icon: ClipboardCheck,
  },
  {
    title: "Learning management",
    description:
      "Materi, quiz, assignment, progress, dan sertifikat disiapkan sebagai modul yang saling terhubung.",
    icon: BookOpen,
  },
  {
    title: "Portal sekolah",
    description:
      "Sekolah dapat memantau absensi, progress, nilai, feedback mentor, dan sertifikat peserta.",
    icon: GraduationCap,
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-teal-700">
              Utero Academy Platform
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-slate-950 md:text-6xl">
              Sistem terpadu untuk pendidikan, magang, dan sertifikasi.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Fondasi awal EMS Utero Academy: website publik, CMS, LMS,
              manajemen magang, absensi, daily report, portal sekolah,
              assessment, dan sertifikat.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" href="/daftar">
                Mulai pendaftaran <ArrowRight size={18} />
              </Link>
              <Link className="button-secondary" href="/login">
                Login dashboard
              </Link>
            </div>
          </div>
          <div className="surface p-6">
            <div className="grid gap-4">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    className="rounded-lg border border-slate-200 p-4"
                    key={item.title}>
                    <div className="flex items-start gap-3">
                      <span className="rounded-md bg-teal-50 p-2 text-teal-700">
                        <Icon size={20} />
                      </span>
                      <div>
                        <h2 className="font-bold text-slate-950">
                          {item.title}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
