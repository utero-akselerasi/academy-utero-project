import { createSupabaseServerClient, createUteroAcademyClient } from "@/lib/supabase/server";
import { getInternProfileId, getMentorProfileId } from "@/features/daily-reports/queries";
import { redirect } from "next/navigation";
import { ProfileFormWrapper } from "./ProfileFormWrapper";

export default async function EditProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const db = await createUteroAcademyClient();
  const { data: userProfile } = await db.from("user_profiles").select("*").eq("id", user.id).maybeSingle();
  const internId = await getInternProfileId(user.id);
  const mentorId = await getMentorProfileId(user.id);
  let internProfile = null;
  if (internId) {
    const { data } = await db.from("intern_profiles").select("*").eq("id", internId).maybeSingle();
    internProfile = data;
  }
  let mentorProfile = null;
  if (mentorId) {
    const { data } = await db.from("mentor_profiles").select("*").eq("id", mentorId).maybeSingle();
    mentorProfile = data;
  }
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">Pengaturan</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Edit Profil Anda</h1>
        <p className="mt-2 text-slate-600">Lengkapi data pribadi, detail institusi, atau kualifikasi Anda.</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <div className="flex flex-col items-center text-center surface p-6 h-fit bg-white">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-teal-500 bg-slate-100 mb-4">
            {userProfile?.avatar_path ? (
              <img src={userProfile.avatar_path} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-teal-50 text-teal-700 font-bold text-2xl">
                {userProfile?.full_name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>
          <h2 className="font-bold text-lg text-slate-950">{userProfile?.full_name || "Nama Pengguna"}</h2>
          <p className="text-xs text-slate-500 break-all">{user.email}</p>
          <div className="mt-4 flex flex-wrap gap-1 justify-center">
            {internProfile && <span className="status-pill text-teal-700 bg-teal-50 border-teal-200">Peserta Magang</span>}
            {mentorProfile && <span className="status-pill text-amber-700 bg-amber-50 border-amber-200">Mentor</span>}
            {!internProfile && !mentorProfile && <span className="status-pill text-slate-700 bg-slate-50 border-slate-200">Staff / Admin</span>}
          </div>
        </div>
        <div>
          <ProfileFormWrapper userProfile={userProfile} internProfile={internProfile} mentorProfile={mentorProfile} />
        </div>
      </div>
    </main>
  );
}