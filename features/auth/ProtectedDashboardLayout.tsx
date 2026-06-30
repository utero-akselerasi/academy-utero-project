import { logoutAction } from "@/features/auth/actions";
import { type RoleCode, userHasAnyRole, getUserRoleCodes } from "@/features/auth/roles";
import { createSupabaseServerClient, createUteroAcademyClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Award, Globe } from "lucide-react";
import { DashboardShell } from "./DashboardShell";

type Props = {
  allowedRoles: RoleCode[];
  title: string;
  homeHref: string;
  children: React.ReactNode;
};

const roleLabelMap: Record<RoleCode, string> = {
  admin: "Administrator",
  school: "Hubungan Sekolah",
  intern: "Peserta Magang",
};

const sidebarItemsMap: Record<RoleCode, { label: string; href: string; icon: string }[]> = {
  admin: [
    { label: "Pendaftaran Masuk", href: "/dashboard/admin/pendaftaran", icon: "FileSpreadsheet" },
    { label: "Penempatan Mentor", href: "/dashboard/admin/penempatan", icon: "UserCheck" },
    { label: "User & Role", href: "/dashboard/super-admin/users", icon: "Users" },
    { label: "Task Board", href: "/dashboard/mentor/tasks", icon: "Kanban" },
    { label: "LMS Penilaian", href: "/dashboard/mentor/lms", icon: "BookOpen" },
    { label: "Review Absensi", href: "/dashboard/mentor/attendance", icon: "Clock" },
    { label: "Daily Report", href: "/dashboard/mentor/daily-reports", icon: "FileText" },
    { label: "Penilaian & Sertifikat", href: "/dashboard/mentor/assessments", icon: "Award" },
    { label: "Website CMS", href: "/dashboard/admin/cms", icon: "Globe" },
    { label: "Audit Log", href: "/dashboard/super-admin/audit-logs", icon: "FileText" },
  ],
  intern: [
    { label: "Dashboard", href: "/dashboard/intern", icon: "LayoutDashboard" },
    { label: "Task Saya", href: "/dashboard/intern/tasks", icon: "CheckSquare" },
    { label: "LMS Pembelajaran", href: "/dashboard/intern/lms", icon: "BookOpen" },
    { label: "Absensi Harian", href: "/dashboard/intern/attendance", icon: "Clock" },
    { label: "Daily Report", href: "/dashboard/intern/daily-reports", icon: "FileText" },
    { label: "Sertifikat Saya", href: "/dashboard/intern/certificate", icon: "Award" },
  ],
  school: [
    { label: "Dashboard", href: "/dashboard/school", icon: "LayoutDashboard" },
  ],
};

export async function ProtectedDashboardLayout({ allowedRoles, homeHref, children }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const allowed = await userHasAnyRole(user.id, allowedRoles);
  if (!allowed) {
    redirect("/login");
  }

  const db = await createUteroAcademyClient();

  // Get user profile details
  const { data: profile } = await db
    .from("user_profiles")
    .select("full_name, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.full_name || user.email || "Pengguna";
  const avatarUrl = profile?.avatar_path || null;
  
  const userRolesList = await getUserRoleCodes(user.id);
  const activeRole = userRolesList.find((r) => allowedRoles.includes(r)) || allowedRoles[0];
  const roleLabel = roleLabelMap[activeRole] || "Pengguna";
  const navItems = sidebarItemsMap[activeRole] || [];

  return (
    <DashboardShell
      userName={userName}
      userEmail={user.email || ""}
      avatarUrl={avatarUrl}
      roleLabel={roleLabel}
      navItems={navItems}
      logoutAction={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
