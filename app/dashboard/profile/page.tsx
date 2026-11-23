import { createUteroAcademyClient } from "@/lib/supabase/server";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { requireUser } from "@/features/auth/guards";
import { isActiveRoleCode } from "@/features/auth/roles";
import { resolveStorageUrl } from "@/lib/storage-urls";
import { ProfileFormWrapper } from "./ProfileFormWrapper";
import { type InternProfileData, isInternBiodataComplete } from "@/features/auth/profile-schema";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";
import { hasApprovedOnboarding } from "@/features/intern/activation";
import Link from "next/link";

type ActivationSnapshot = {
  profile: { id: string; status: string; start_date: string | null; end_date: string | null } | null;
  application: {
    status: string; onboarding_status: string; converted_intern_id: string | null;
    approved_start_date: string | null; approved_end_date: string | null;
  } | null;
};
export default async function EditProfilePage({ searchParams }: { searchParams: Promise<{ internAccess?: string }> }) {
  // Halaman profil terbuka untuk semua peran yang login, jadi requireUser()
  // saja - tetapi guard-nya harus di page: layout dan page dirender bersamaan.
  const user = await requireUser();
  const { internAccess } = await searchParams;
  let userProfile: any = null;
  let internProfile: InternProfileData | null = null;
  let roles: Array<{ code: string; name: string }> = [];
  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/profile");
    if (response.ok) {
      const data = await response.json() as { profile: any; internProfile: InternProfileData | null; roles: Array<{ code: string; name: string }> };
      userProfile = data.profile;
      internProfile = data.internProfile;
      roles = data.roles.filter((role) => isActiveRoleCode(role.code));
    }
  } else {
    const db = await createUteroAcademyClient();
    const { data: profile } = await db.from("user_profiles").select("*").eq("id", user.id).maybeSingle();
    userProfile = profile;
    const internId = await getInternProfileId(user.id);    if (internId) {
      const { data } = await db.from("intern_profiles")
        .select("id, full_name, phone, major, grade_or_semester, school_name, address, school_supervisor_name, school_supervisor_phone, emergency_contact_name, emergency_contact_phone, schools(name)")
        .eq("id", internId).returns<InternProfileData>().maybeSingle();
      internProfile = data;
    }
    const { data: userRoles } = await db.from("user_roles").select("roles(code, name)").eq("user_id", user.id).returns<any[]>();
    roles = (userRoles || []).map((ur) => (Array.isArray(ur.roles) ? ur.roles[0] : ur.roles))
      .filter((roleObj) => roleObj && isActiveRoleCode(roleObj.code));
  }

  const biodataComplete = Boolean(internProfile && isInternBiodataComplete(internProfile, userProfile?.full_name ?? null, user.email ?? null));
  let activation: ActivationSnapshot | null = null;
  if (usesLocalBackend() && roles.some((role) => role.code === "intern")) {
    const response = await backendRequest("/v1/auth/intern-activation");
    if (response.ok) activation = await response.json() as ActivationSnapshot;
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const approved = Boolean(activation?.profile && (
    activation.application ? hasApprovedOnboarding(activation.application, activation.profile) : activation.profile.status === "active"
  ));
  const startDate = activation?.profile?.start_date;
  const periodEnded = Boolean(activation?.profile?.end_date && activation.profile.end_date < today);
  const inactive = Boolean(activation?.profile && ["paused", "completed", "failed", "alumni"].includes(activation.profile.status));
  const canOpenInternDashboard = Boolean(biodataComplete && approved && startDate && startDate <= today && !periodEnded && !inactive);
  const avatarUrl = await resolveStorageUrl("academy-private", userProfile?.avatar_path);

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
      <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">Akun / pengaturan</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Profil dan keamanan</h1>
        <p className="mt-1 text-sm text-slate-300">Perbarui identitas, detail akademik bila berlaku, lalu simpan. Kata sandi diubah terpisah.</p>
        {internProfile && !isInternBiodataComplete(internProfile, userProfile?.full_name ?? null, user.email ?? null) && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900" role="status">
            Biodata belum lengkap. Isi semua kolom wajib sebelum melanjutkan ke dashboard peserta.
          </p>
        )}


        {internAccess === "check" && (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900" role="status">
            Status peserta belum dapat diperiksa. Coba buka menu lagi beberapa saat, atau hubungi admin jika masalah berlanjut.
          </p>
        )}
      </div>
      {roles.some((role) => role.code === "intern") && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5" aria-label="Status akses magang">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">Langkah berikutnya</p>
            <h2 className="mt-1 text-base font-bold text-slate-950">{canOpenInternDashboard ? "Kegiatan magang siap" : "Akses kegiatan magang belum aktif"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600" role="status">
              {!internProfile ? "Profil peserta belum dibuat. Hubungi admin pendaftaran." :
                !biodataComplete ? "Lengkapi kolom wajib di bawah, lalu klik Simpan Perubahan." :
                !activation ? "Status onboarding belum dapat diperiksa. Coba muat ulang halaman ini." :
                !approved ? "Biodata tersimpan. Admin perlu menyetujui onboarding pada detail pendaftaran sebelum kegiatan magang dapat dimulai." :
                !startDate ? "Tanggal mulai magang belum ditetapkan. Hubungi admin pendaftaran." :
                startDate > today ? `Biodata siap. Kegiatan magang dimulai ${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(startDate))}.` :
                periodEnded || inactive ? "Periode atau status peserta saat ini tidak mengizinkan kegiatan magang. Hubungi admin." :
                "Biodata dan onboarding sudah siap. Anda dapat membuka dashboard peserta dan memulai kegiatan magang."}
            </p>
          </div>
          {canOpenInternDashboard && (
            <Link href="/dashboard/intern" className="button-primary mt-3 inline-flex min-h-11 shrink-0 items-center justify-center sm:mt-0">Buka dashboard peserta</Link>
          )}
        </section>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm lg:sticky lg:top-4">
          <p className="mb-3 self-start text-xs font-bold uppercase tracking-wider text-slate-500">Pratinjau profil</p>
          <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-teal-500 bg-slate-100 mb-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-teal-50 text-teal-700 font-bold text-2xl">
                {userProfile?.full_name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-950">{userProfile?.full_name || "Nama belum diisi"}</h2>
          <p className="text-xs text-slate-500 break-all">{user.email}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-1">
            {roles.length > 0 ? (
              roles.map((role: any) => {
                let badgeClass = "text-slate-700 bg-slate-50 border-slate-200";
                if (role.code === "intern") {
                  badgeClass = "text-teal-700 bg-teal-50 border-teal-200";
                } else if (role.code === "super_admin") {
                  badgeClass = "text-red-700 bg-red-50 border-red-200";
                } else if (role.code === "admin") {
                  badgeClass = "text-blue-700 bg-blue-50 border-blue-200";
                } else if (role.code === "school") {
                  badgeClass = "text-indigo-700 bg-indigo-50 border-indigo-200";
                }
                
                return (
                  <span key={role.code} className={`status-pill ${badgeClass}`}>
                    {role.name}
                  </span>
                );
              })
            ) : (
              <span className="status-pill text-slate-700 bg-slate-50 border-slate-200">
                Tanpa Role
              </span>
            )}
          </div>
          <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600">Foto dan perubahan data muncul setelah profil disimpan.</p>
        </div>
        <div>
          <ProfileFormWrapper userProfile={userProfile} internProfile={internProfile} email={user.email ?? ""} />
        </div>
      </div>
    </main>
  );
}
