import { RoleDashboardHome } from "@/features/dashboard/RoleDashboardHome";

export default function SchoolDashboardPage() {
  return (
    <RoleDashboardHome
      description="Area sekolah untuk memantau absensi, task, progress, nilai, sertifikat, dan feedback mentor."
      eyebrow="Sekolah"
      items={["Monitoring Peserta", "Absensi", "Progress", "Sertifikat"]}
      title="Dashboard Sekolah"
    />
  );
}

