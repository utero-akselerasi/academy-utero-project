import Link from "next/link";
import { FileText, Users, ClipboardCheck, Clock, Award } from "lucide-react";

const modules = [
  {
    title: "Task Board",
    description: "Kelola task board, list, dan card. Assign task ke peserta bimbingan.",
    href: "/dashboard/mentor/tasks",
    icon: ClipboardCheck,
    ready: true,
  },
  {
    title: "Review Absensi",
    description: "Lakukan verifikasi dan review absensi GPS bimbingan.",
    href: "/dashboard/mentor/attendance",
    icon: Clock,
    ready: true,
  },
  {
    title: "Daily Report",
    description: "Review dan approve laporan harian peserta bimbingan.",
    href: "/dashboard/mentor/daily-reports",
    icon: FileText,
    ready: true,
  },
  {
    title: "Peserta Bimbingan",
    description: "Lihat daftar peserta yang sedang dibimbing dan statusnya.",
    href: "/dashboard/mentor",
    icon: Users,
    ready: false,
  },
];

export default function MentorDashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Mentor</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Dashboard Mentor</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          Area mentor untuk melihat peserta bimbingan, task, daily report, absensi, dan assessment.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const content = (
            <>
              <div className="flex items-start gap-3">
                <span className="rounded-md bg-teal-50 p-2 text-teal-700">
                  <Icon size={20} />
                </span>
                <div>
                  <h2 className="font-bold text-slate-950">{mod.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{mod.description}</p>
                </div>
              </div>
              {!mod.ready ? (
                <span className="mt-3 inline-block text-xs font-bold text-slate-400">Segera hadir</span>
              ) : null}
            </>
          );

          if (mod.ready) {
            return (
              <Link className="surface block p-5 hover:border-teal-500" href={mod.href} key={mod.title}>
                {content}
              </Link>
            );
          }

          return (
            <div className="surface p-5 opacity-60" key={mod.title}>
              {content}
            </div>
          );
        })}
      </div>
    </main>
  );
}
