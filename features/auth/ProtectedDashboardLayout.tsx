import { logoutAction } from "@/features/auth/actions";
import { requireRole } from "@/features/auth/guards";
import { type RoleCode, getUserRoleCodes, resolveActiveRole } from "@/features/auth/roles";
import { resolveStorageUrl } from "@/lib/storage-urls";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";
import { createUteroAcademyClient } from "@/lib/supabase/server";
import { DashboardShell, type NavIconName } from "./DashboardShell";

type Props = {
  allowedRoles: RoleCode[];
  title: string;
  homeHref: string;
  children: React.ReactNode;
};

const roleLabelMap: Record<RoleCode, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  school: "Hubungan Sekolah",
  intern: "Peserta Magang",
  applicant: "Calon Peserta",
};

/**
 * `icon` bertipe `NavIconName`, bukan `string` (M-7).
 *
 * Dengan `string`, nama ikon yang tidak ada di `iconMap` milik `DashboardShell`
 * lolos kompilasi dan gagal senyap saat render — itulah yang terjadi pada
 * `"BookOpen"` di ketiga menu LMS: ikonnya jatuh ke fallback dashboard sehingga
 * sidebar punya dua item dengan ikon sama, tanpa satu pun error. Tipe ini
 * memindahkan kesalahan itu ke `tsc`.
 *
 * Import `Award` dan `Globe` dari `lucide-react` ikut dihapus: keduanya tidak
 * pernah dipakai di berkas ini — yang ada hanya string namanya — jadi komponen
 * ikonnya masuk ke bundle tanpa pernah dirender di sini.
 */
const sidebarItemsMap: Record<RoleCode, { section: string; label: string; href: string; icon: NavIconName }[]> = {
  super_admin: [
    { section: "Ringkasan", label: "Pusat Kendali", href: "/dashboard/super-admin", icon: "LayoutDashboard" },
    { section: "Manajemen", label: "User & Role", href: "/dashboard/super-admin/users", icon: "Users" },
    { section: "Manajemen", label: "Manajemen Instansi", href: "/dashboard/super-admin/schools", icon: "GraduationCap" },
    { section: "Manajemen", label: "Logs Activity", href: "/dashboard/super-admin/audit-logs", icon: "FileText" },
    { section: "Pendaftaran & Seleksi", label: "Dashboard Admin", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { section: "Pendaftaran & Seleksi", label: "Pendaftaran Masuk", href: "/dashboard/admin/pendaftaran", icon: "FileSpreadsheet" },
    { section: "Pendaftaran & Seleksi", label: "Program Magang", href: "/dashboard/admin/programs", icon: "BookOpen" },
    { section: "Pendaftaran & Seleksi", label: "Seleksi Calon Peserta", href: "/dashboard/mentor/selection", icon: "CheckSquare" },
    { section: "Akademi", label: "Task Board", href: "/dashboard/mentor/tasks", icon: "Kanban" },
    { section: "Akademi", label: "LMS Penilaian", href: "/dashboard/mentor/lms", icon: "BookOpen" },
    { section: "Akademi", label: "Review Absensi", href: "/dashboard/mentor/attendance", icon: "Clock" },
    { section: "Akademi", label: "Daily Report", href: "/dashboard/mentor/daily-reports", icon: "FileText" },
    { section: "Akademi", label: "Penilaian & Sertifikat", href: "/dashboard/mentor/assessments", icon: "Award" },
    { section: "Konten Website", label: "Website CMS", href: "/dashboard/admin/cms", icon: "Globe" },
    { section: "Konten Website", label: "Landing Page", href: "/dashboard/admin/landing", icon: "LayoutTemplate" },
  ],
  admin: [
    { section: "Ringkasan", label: "Dashboard", href: "/dashboard/admin", icon: "LayoutDashboard" },
    { section: "Pendaftaran & Seleksi", label: "Pendaftaran Masuk", href: "/dashboard/admin/pendaftaran", icon: "FileSpreadsheet" },
    { section: "Pendaftaran & Seleksi", label: "Program Magang", href: "/dashboard/admin/programs", icon: "BookOpen" },
    { section: "Pendaftaran & Seleksi", label: "Seleksi Calon Peserta", href: "/dashboard/mentor/selection", icon: "CheckSquare" },
    { section: "Akademi", label: "Task Board", href: "/dashboard/mentor/tasks", icon: "Kanban" },
    { section: "Akademi", label: "LMS Penilaian", href: "/dashboard/mentor/lms", icon: "BookOpen" },
    { section: "Akademi", label: "Review Absensi", href: "/dashboard/mentor/attendance", icon: "Clock" },
    { section: "Akademi", label: "Daily Report", href: "/dashboard/mentor/daily-reports", icon: "FileText" },
    { section: "Akademi", label: "Penilaian & Sertifikat", href: "/dashboard/mentor/assessments", icon: "Award" },
    { section: "Konten Website", label: "Website CMS", href: "/dashboard/admin/cms", icon: "Globe" },
    { section: "Konten Website", label: "Landing Page", href: "/dashboard/admin/landing", icon: "LayoutTemplate" },
  ],
  intern: [
    { section: "Ringkasan", label: "Dashboard", href: "/dashboard/intern", icon: "LayoutDashboard" },
    { section: "Kegiatan Magang", label: "Task Saya", href: "/dashboard/intern/tasks", icon: "CheckSquare" },
    { section: "Kegiatan Magang", label: "LMS Pembelajaran", href: "/dashboard/intern/lms", icon: "BookOpen" },
    { section: "Kegiatan Magang", label: "Absensi Harian", href: "/dashboard/intern/attendance", icon: "Clock" },
    { section: "Kegiatan Magang", label: "Daily Report", href: "/dashboard/intern/daily-reports", icon: "FileText" },
    { section: "Kegiatan Magang", label: "Sertifikat Saya", href: "/dashboard/intern/certificate", icon: "Award" },
  ],
  school: [
    { section: "Ringkasan", label: "Dashboard", href: "/dashboard/school", icon: "LayoutDashboard" },
    { section: "Pendaftaran", label: "Pendaftaran Siswa", href: "/dashboard/school/applications", icon: "FileSpreadsheet" },
  ],
  applicant: [
    { section: "Pendaftaran", label: "Status Pendaftaran", href: "/dashboard/applicant", icon: "LayoutDashboard" },
    { section: "Pendaftaran", label: "Tes Seleksi", href: "/dashboard/applicant/selection", icon: "FileSpreadsheet" },
  ],
};

export async function ProtectedDashboardLayout({ allowedRoles, homeHref, children }: Props) {
  const user = await requireRole(allowedRoles);

  let profile: { full_name?: string | null; avatar_path?: string | null } | null = null;
  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/profile");
    if (response.ok) {
      profile = ((await response.json()) as { profile?: typeof profile }).profile ?? null;
    }
  } else {
    const db = await createUteroAcademyClient();
    const result = await db
      .from("user_profiles")
      .select("full_name, avatar_path")
      .eq("id", user.id)
      .maybeSingle();
    profile = result.data;
  }

  const userName = profile?.full_name || user.email || "Pengguna";

  // Avatar Academy berada di bucket `academy-private`. URL legacy `avatars`
  // diparsing menjadi object path setelah objeknya disalin ke bucket baru.
  //
  // Ditandatangani DI SINI, bukan di komponen yang merendernya. `DashboardShell`
  // menampilkan avatar dua kali (header + menu) dan ia komponen klien, jadi tidak
  // bisa menandatangani sendiri. Layout ini satu-satunya titik yang sudah membaca
  // `avatar_path` dan membungkus setiap halaman dashboard untuk setiap peran —
  // menandatangani di tempat lain berarti mengulanginya di setiap halaman.
  const avatarUrl = await resolveStorageUrl("academy-private", profile?.avatar_path);

  const userRolesList = await getUserRoleCodes(user.id);

  // Peran aktif dipilih menurut rolePriority, bukan urutan baris dari database:
  // user ber-peran ganda (super_admin + admin wajar terjadi) harus mendapat
  // sidebar yang sama di setiap render. Fallback ke allowedRoles[0] dihapus —
  // itu menampilkan sidebar peran yang belum tentu dimiliki user.
  const activeRole = resolveActiveRole(userRolesList, allowedRoles);
  const roleLabel = activeRole ? roleLabelMap[activeRole] : "Pengguna";
  const navItems = activeRole ? sidebarItemsMap[activeRole] : [];

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
