import { RoleDashboardHome } from "@/features/dashboard/RoleDashboardHome";

export default function MentorDashboardPage() {
  return (
    <RoleDashboardHome
      description="Area mentor untuk melihat peserta bimbingan, task, daily report, absensi, dan assessment."
      eyebrow="Mentor"
      items={["Peserta Bimbingan", "Task Review", "Daily Report", "Assessment"]}
      title="Dashboard Mentor"
    />
  );
}

