import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function SuperAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout
      allowedRoles={["super_admin"]}
      homeHref="/dashboard/super-admin"
      title="Dashboard Super Admin"
    >
      {children}
    </ProtectedDashboardLayout>
  );
}

