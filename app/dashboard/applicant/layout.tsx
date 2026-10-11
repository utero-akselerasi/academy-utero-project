import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default function ApplicantLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedDashboardLayout allowedRoles={["applicant", "super_admin"]} homeHref="/dashboard/applicant" title="Portal Calon Peserta">
      {children}
    </ProtectedDashboardLayout>
  );
}
