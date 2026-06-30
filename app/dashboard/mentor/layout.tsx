import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";

export default async function MentorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedDashboardLayout allowedRoles={["admin"]} homeHref="/dashboard/mentor" title="Dashboard Mentor">
      {children}
    </ProtectedDashboardLayout>
  );
}
