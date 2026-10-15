import { requireRole } from "@/features/auth/guards";
import { createUteroAcademyClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { usesLocalBackend } from "@/lib/backend/mode";
import { schoolBackend, mapLocalApplication } from "@/features/school/local";
import { applicationFilterSchema } from "./schemas";
import type { ApplicationFilters, PublicSelectionResult, SchoolApplication, SchoolPartnerContext } from "./types";

const ACTIVE_PARTNER_STATUSES = new Set(["verified", "active_partner"]);

type SchoolContactRow = {
  school_id: string;
  schools: {
    id: string;
    name: string;
    partner_status: string | null;
  } | Array<{
    id: string;
    name: string;
    partner_status: string | null;
  }> | null;
};

type ApplicationRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  student_number: string | null;
  major: string | null;
  motivation: string | null;
  status: SchoolApplication["status"];
  selection_status: SchoolApplication["selectionStatus"] | null;
  onboarding_status: SchoolApplication["onboardingStatus"] | null;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  applicant_user_id: string | null;
};

function firstRelation<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function mapApplication(row: ApplicationRow): SchoolApplication {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    studentNumber: row.student_number,
    major: row.major,
    motivation: row.motivation,
    status: row.status,
    selectionStatus: row.selection_status ?? "not_assigned",
    onboardingStatus: row.onboarding_status ?? "not_started",
    proposedStartDate: row.proposed_start_date,
    proposedEndDate: row.proposed_end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    applicantUserId: row.applicant_user_id,
  };
}

export async function requireActiveSchoolPartner(): Promise<{
  userId: string;
  school: SchoolPartnerContext;
}> {
  if (usesLocalBackend()) {
    const user = await requireRole(["school"]);
    const body = await schoolBackend<{ school: { id: string; name: string; partner_status: string } }>("/context");
    if (!body.school.partner_status || !ACTIVE_PARTNER_STATUSES.has(body.school.partner_status)) throw new Error("Pendaftaran hanya tersedia untuk sekolah/kampus partner terverifikasi dan aktif.");
    return { userId: user.id, school: { id: body.school.id, name: body.school.name, partnershipStatus: body.school.partner_status } };
  }
  const user = await requireRole(["school"]);
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("school_contacts")
    .select("school_id, schools(id, name, partner_status)")
    .eq("user_id", user.id)
    .maybeSingle<SchoolContactRow>();

  const school = firstRelation(data?.schools ?? null);
  if (error || !data || !school || data.school_id !== school.id) {
    throw new Error("Akun sekolah belum terhubung ke instansi.");
  }
  if (!school.partner_status || !ACTIVE_PARTNER_STATUSES.has(school.partner_status)) {
    throw new Error("Pendaftaran hanya tersedia untuk sekolah/kampus partner terverifikasi dan aktif.");
  }

  return {
    userId: user.id,
    school: {
      id: school.id,
      name: school.name,
      partnershipStatus: school.partner_status,
    },
  };
}

export async function getOwnSchoolApplications(filters: ApplicationFilters = {}) {
  if (usesLocalBackend()) {
    const parsed = applicationFilterSchema.parse(filters);
    const query = new URLSearchParams({ status: parsed.status, selectionStatus: parsed.selectionStatus, query: parsed.query });
    const body = await schoolBackend<{ school: any; applications: any[] }>(`/applications?${query}`);
    return { school: { id: body.school.id, name: body.school.name, partnershipStatus: body.school.partner_status }, applications: body.applications.map(mapLocalApplication) };
  }
  const { school } = await requireActiveSchoolPartner();
  const parsed = applicationFilterSchema.parse(filters);
  const db = await createUteroAcademyServiceRoleClient();
  let query = db
    .from("internship_applications")
    .select("id, full_name, email, phone, student_number, major, motivation, status, selection_status, onboarding_status, proposed_start_date, proposed_end_date, created_at, updated_at, reviewed_at, applicant_user_id")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false });

  if (parsed.status !== "all") query = query.eq("status", parsed.status);
  if (parsed.selectionStatus !== "all") query = query.eq("selection_status", parsed.selectionStatus);
  if (parsed.query) {
    const safeQuery = parsed.query.replace(/[,%()]/g, " ").trim();
    if (safeQuery) query = query.or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,student_number.ilike.%${safeQuery}%`);
  }

  const { data, error } = await query.returns<ApplicationRow[]>();
  if (error) throw new Error("Data pendaftaran sekolah belum dapat dibaca.");
  return { school, applications: (data ?? []).map(mapApplication) };
}

export async function getOwnSchoolApplication(applicationId: string) {
  if (usesLocalBackend()) {
    try { const body = await schoolBackend<{ school: any; application: any }>(`/applications/${applicationId}`); return { school: { id: body.school.id, name: body.school.name, partnershipStatus: body.school.partner_status }, application: mapLocalApplication(body.application) }; }
    catch { return { school: null as any, application: null }; }
  }
  const { school } = await requireActiveSchoolPartner();
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("internship_applications")
    .select("id, full_name, email, phone, student_number, major, motivation, status, selection_status, onboarding_status, proposed_start_date, proposed_end_date, created_at, updated_at, reviewed_at, applicant_user_id")
    .eq("id", applicationId)
    .eq("school_id", school.id)
    .maybeSingle<ApplicationRow>();

  if (error) throw new Error("Detail pendaftaran belum dapat dibaca.");
  return { school, application: data ? mapApplication(data) : null };
}

export async function getOwnSchoolSelectionResults(applicationId: string): Promise<PublicSelectionResult[]> {
  if (usesLocalBackend()) {
    try { const body = await schoolBackend<{ selectionResults: any[] }>(`/applications/${applicationId}`); return body.selectionResults.map((row) => ({ decisionId: row.decision_id, result: row.result, finalScore: row.final_score, publicNote: row.public_note, decidedAt: row.decided_at })); }
    catch { return []; }
  }
  const { school } = await requireActiveSchoolPartner();
  const db = await createUteroAcademyServiceRoleClient();
  const { data: application, error: applicationError } = await db
    .from("internship_applications")
    .select("id")
    .eq("id", applicationId)
    .eq("school_id", school.id)
    .maybeSingle();
  if (applicationError || !application) return [];

  const sessionDb = await createUteroAcademyClient();
  const { data, error } = await sessionDb.rpc("visible_selection_results", { p_application_id: applicationId });
  if (error) throw new Error("Ringkasan nilai belum dapat dibaca.");
  return (data ?? []).map((row: { decision_id: string; result: string; final_score: number | null; public_note: string | null; decided_at: string }) => ({
    decisionId: row.decision_id,
    result: row.result,
    finalScore: row.final_score,
    publicNote: row.public_note,
    decidedAt: row.decided_at,
  }));
}
