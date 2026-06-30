import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

export async function getSchoolProfile(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  
  const { data: contact, error: contactErr } = await db
    .from("school_contacts")
    .select("school_id, schools(id, name, type, city, province, address)")
    .eq("user_id", userId)
    .maybeSingle();

  if (contactErr || !contact) {
    return { data: null, error: contactErr };
  }

  const schoolObj = Array.isArray(contact.schools) ? contact.schools[0] : contact.schools;
  return { data: schoolObj, error: null };
}

export async function getSchoolInterns(schoolId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data, error } = await db
    .from("intern_profiles")
    .select("id, full_name, email, phone, major, grade_or_semester, status, start_date, end_date, certificates(id, certificate_number, status)")
    .eq("school_id", schoolId)
    .order("full_name", { ascending: true })
    .returns<any[]>();

  const mapped = (data || []).map(i => {
    const cert = Array.isArray(i.certificates) ? i.certificates[0] : i.certificates;
    return {
      ...i,
      certificate: cert ? {
        id: cert.id,
        certificate_number: cert.certificate_number,
        status: cert.status
      } : null
    };
  });

  return { data: mapped, error };
}

export async function getSchoolInternsDailyReports(schoolId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  // Ambil semua intern_profiles untuk sekolah ini
  const { data: interns } = await db
    .from("intern_profiles")
    .select("id, full_name")
    .eq("school_id", schoolId);

  if (!interns || interns.length === 0) {
    return { data: [], error: null };
  }

  const internIds = interns.map(i => i.id);

  const { data, error } = await db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, daily_report_attachments(id, file_path, file_name, mime_type)")
    .in("intern_id", internIds)
    .order("report_date", { ascending: false });

  if (error || !data) {
    return { data: [], error };
  }

  // Map nama anak magang ke daily report
  const internMap = new Map(interns.map(i => [i.id, i.full_name]));
  const mapped = data.map(r => ({
    ...r,
    intern_name: internMap.get(r.intern_id) || "Peserta"
  }));

  return { data: mapped, error: null };
}

export async function getSchoolInternsAttendances(schoolId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  // Ambil semua intern_profiles untuk sekolah ini
  const { data: interns } = await db
    .from("intern_profiles")
    .select("id, full_name")
    .eq("school_id", schoolId);

  if (!interns || interns.length === 0) {
    return { data: [], error: null };
  }

  const internIds = interns.map(i => i.id);

  const { data, error } = await db
    .from("attendances")
    .select("id, intern_id, attendance_date, check_in_at, check_out_at, status, review_note")
    .in("intern_id", internIds)
    .order("attendance_date", { ascending: false });

  if (error || !data) {
    return { data: [], error };
  }

  const internMap = new Map(interns.map(i => [i.id, i.full_name]));
  const mapped = data.map(a => ({
    ...a,
    intern_name: internMap.get(a.intern_id) || "Peserta"
  }));

  return { data: mapped, error: null };
}
