import { RoleDashboardHome } from "@/features/dashboard/RoleDashboardHome";

export default function InternDashboardPage() {
  return (
    <RoleDashboardHome
      description="Area peserta untuk melihat task, submit absensi, mengisi daily report, belajar, dan melihat sertifikat."
      eyebrow="Peserta"
      items={["Task Saya", "Absensi", "Daily Report", "Materi Belajar"]}
      title="Dashboard Peserta Magang"
    />
  );
}

