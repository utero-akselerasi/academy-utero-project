import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout allowedRoles={["admin", "school", "intern"]} homeHref="/dashboard" title="Profil">
      {children}
    </ProtectedDashboardLayout>
  );
}
