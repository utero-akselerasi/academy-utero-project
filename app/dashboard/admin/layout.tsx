import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout
      allowedRoles={["admin", "super_admin"]}
      homeHref="/dashboard/admin"
      title="Dashboard Admin"
    >
      {children}
    </ProtectedDashboardLayout>
  );
}
