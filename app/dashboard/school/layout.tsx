import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function SchoolLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout allowedRoles={["school", "super_admin"]} homeHref="/dashboard/school" title="Dashboard Sekolah">
      {children}
    </ProtectedDashboardLayout>
  );
}
