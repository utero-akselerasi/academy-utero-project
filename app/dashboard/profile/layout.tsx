import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout allowedRoles={["admin", "admin_academy", "school", "intern", "super_admin"]} homeHref="/dashboard" title="Profil">
      {children}
    </ProtectedDashboardLayout>
  );
}
