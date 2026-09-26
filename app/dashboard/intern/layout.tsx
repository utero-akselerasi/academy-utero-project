import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function InternLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout allowedRoles={["intern", "super_admin"]} homeHref="/dashboard/intern" title="Dashboard Peserta">
      {children}
    </ProtectedDashboardLayout>
  );
}
