import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout
      allowedRoles={["super_admin", "admin_academy"]}
      homeHref="/dashboard/admin/pendaftaran"
      title="Dashboard Admin"
    >
      {children}
    </ProtectedDashboardLayout>
  );
}
