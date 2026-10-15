import { ProtectedDashboardLayout } from "@/features/auth/ProtectedDashboardLayout";
import { requireRole } from "@/features/auth/guards";
import { type InternProfileData, isInternBiodataComplete } from "@/features/auth/profile-schema";
import { userHasAnyRole } from "@/features/auth/roles";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";
import { createUteroAcademyClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function InternLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireRole(["intern", "super_admin"]);
  if (!(await userHasAnyRole(user.id, ["super_admin"]))) {
    let internProfile: (InternProfileData & { start_date?: string | null }) | null = null;
    let fullName: string | null = null;
    let convertedApplication = false;
    let failed = false;
    if (usesLocalBackend()) {
      const response = await backendRequest("/v1/profile");
      if (!response.ok) failed = true;
      else {
        const body = await response.json() as {
          profile?: { full_name?: string | null };
          internProfile?: (InternProfileData & { start_date?: string | null }) | null;
          convertedApplication?: boolean;
        };
        internProfile = body.internProfile ?? null;
        fullName = body.profile?.full_name ?? null;
        convertedApplication = Boolean(body.convertedApplication);
      }
    } else {
      const db = await createUteroAcademyClient();
      const [{ data, error }, { data: userProfile }, { data: application }] = await Promise.all([
        db.from("intern_profiles")
          .select("id, full_name, phone, major, grade_or_semester, school_name, address, school_supervisor_name, school_supervisor_phone, emergency_contact_name, emergency_contact_phone, start_date, end_date")
          .eq("user_id", user.id).maybeSingle(),
        db.from("user_profiles").select("full_name").eq("id", user.id).maybeSingle(),
        db.from("internship_applications").select("id").eq("applicant_user_id", user.id).not("converted_intern_id", "is", null).limit(1).maybeSingle(),
      ]);
      internProfile = data as (InternProfileData & { start_date?: string | null }) | null;
      fullName = userProfile?.full_name ?? null;
      convertedApplication = Boolean(application);
      failed = Boolean(error);
    }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (failed || !isInternBiodataComplete(internProfile, fullName, user.email ?? null) || (convertedApplication && (!internProfile?.start_date || internProfile.start_date > today))) {
      redirect("/dashboard/profile");
    }
  }
  return (
    <ProtectedDashboardLayout allowedRoles={["intern", "super_admin"]} homeHref="/dashboard/intern" title="Dashboard Peserta">
      {children}
    </ProtectedDashboardLayout>
  );
}
