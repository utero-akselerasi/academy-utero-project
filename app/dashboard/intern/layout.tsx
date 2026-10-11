import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";
import { requireRole } from "@/features/auth/guards";
import { type InternProfileData, isInternBiodataComplete } from "@/features/auth/profile-schema";
import { userHasAnyRole } from "@/features/auth/roles";
import { createUteroAcademyClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function InternLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireRole(["intern", "super_admin"]);
  if (!(await userHasAnyRole(user.id, ["super_admin"]))) {
    const db = await createUteroAcademyClient();
    const [{ data: internProfile, error }, { data: userProfile }, { data: convertedApplication }] = await Promise.all([
      db.from("intern_profiles")
        .select("id, full_name, phone, major, grade_or_semester, school_name, address, school_supervisor_name, school_supervisor_phone, emergency_contact_name, emergency_contact_phone, start_date, end_date")
        .eq("user_id", user.id).maybeSingle(),
      db.from("user_profiles").select("full_name").eq("id", user.id).maybeSingle(),
      db.from("internship_applications").select("id").eq("applicant_user_id", user.id).not("converted_intern_id", "is", null).limit(1).maybeSingle(),
    ]);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (error || !isInternBiodataComplete(internProfile as InternProfileData, userProfile?.full_name ?? null, user.email ?? null) || (convertedApplication && (!internProfile?.start_date || internProfile.start_date > today))) {
      redirect("/dashboard/profile");
    }
  }
  return (
    <ProtectedDashboardLayout allowedRoles={["intern", "super_admin"]} homeHref="/dashboard/intern" title="Dashboard Peserta">
      {children}
    </ProtectedDashboardLayout>
  );
}
