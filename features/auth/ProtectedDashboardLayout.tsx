import { logoutAction } from "@/features/auth/actions";
import { requireRole } from "@/features/auth/guards";
import { type RoleCode, getUserRoleCodes } from "@/features/auth/roles";
import { createUteroAcademyClient } from "@/lib/supabase/server";
import { Award, Globe } from "lucide-react";
import { DashboardShell } from "./DashboardShell";

type Props = {
  allowedRoles: RoleCode[];
  title: string;
  homeHref: string;
  children: React.ReactNode;
};

const roleLabelMap: Record<RoleCode, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  admin_academy: "Administrator",
  mentor: "Mentor",
  school: "Hubungan Sekolah",
  intern: "Peserta Magang",
};

const sidebarItemsMap: Record<RoleCode, { label: string; href: string; icon: string }[]> = {
  super_admin: [
    { label: "Pusat Kendali", href: "/dashboard/super-admin", icon: "LayoutDashboard" },
    { label: "User & Role", href: "/dashboard/super-admin/users", icon: "Users" },
    { label: "Manajemen Instansi", href: "/dashboard/super-admin/schools", icon: "GraduationCap" },
    { label: "Logs Activity", href: "/dashboard/super-admin/audit-logs", icon: "FileText" },
    { label: "Dashboard Admin", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { label: "Pendaftaran Masuk", href: "/dashboard/admin/pendaftaran", icon: "FileSpreadsheet" },
    { label: "Task Board", href: "/dashboard/mentor/tasks", icon: "Kanban" },
    { label: "LMS Penilaian", href: "/dashboard/mentor/lms", icon: "BookOpen" },
    { label: "Review Absensi", href: "/dashboard/mentor/attendance", icon: "Clock" },
    { label: "Daily Report", href: "/dashboard/mentor/daily-reports", icon: "FileText" },
    { label: "Penilaian & Sertifikat", href: "/dashboard/mentor/assessments", icon: "Award" },
    { label: "Website CMS", href: "/dashboard/admin/cms", icon: "Globe" },
    { label: "Landing Page", href: "/dashboard/admin/landing", icon: "LayoutTemplate" },
  ],
  admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { label: "Pendaftaran Masuk", href: "/dashboard/admin/pendaftaran", icon: "FileSpreadsheet" },
    { label: "Task Board", href: "/dashboard/mentor/tasks", icon: "Kanban" },
    { label: "LMS Penilaian", href: "/dashboard/mentor/lms", icon: "BookOpen" },
    { label: "Review Absensi", href: "/dashboard/mentor/attendance", icon: "Clock" },
    { label: "Daily Report", href: "/dashboard/mentor/daily-reports", icon: "FileText" },
    { label: "Penilaian & Sertifikat", href: "/dashboard/mentor/assessments", icon: "Award" },
    { label: "Website CMS", href: "/dashboard/admin/cms", icon: "Globe" },
    { label: "Landing Page", href: "/dashboard/admin/landing", icon: "LayoutTemplate" },
  ],
  admin_academy: [
    { label: "Dashboard", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { label: "Pendaftaran Masuk", href: "/dashboard/admin/pendaftaran", icon: "FileSpreadsheet" },
    { label: "Task Board", href: "/dashboard/mentor/tasks", icon: "Kanban" },
    { label: "LMS Penilaian", href: "/dashboard/mentor/lms", icon: "BookOpen" },
    { label: "Review Absensi", href: "/dashboard/mentor/attendance", icon: "Clock" },
    { label: "Daily Report", href: "/dashboard/mentor/daily-reports", icon: "FileText" },
    { label: "Penilaian & Sertifikat", href: "/dashboard/mentor/assessments", icon: "Award" },
    { label: "Website CMS", href: "/dashboard/admin/cms", icon: "Globe" },
    { label: "Landing Page", href: "/dashboard/admin/landing", icon: "LayoutTemplate" },
  ],
  mentor: [],
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
  const user = await requireRole(allowedRoles);

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
