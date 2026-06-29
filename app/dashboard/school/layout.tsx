import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function SchoolLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout allowedRoles={["school"]} homeHref="/dashboard/school" title="Dashboard Sekolah">
      {children}
    </ProtectedDashboardLayout>
  );
}

