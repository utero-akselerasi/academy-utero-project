import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

import { backendRequest, usesLocalBackend } from "@/lib/backend/server";

export async function getAdminDashboardStats() {
  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/admin/dashboard");
    if (!response.ok) throw new Error(`Gagal membaca dashboard admin (${response.status}).`);
    return response.json() as Promise<{
      metrics: { totalInterns: number; totalSchools: number; totalTasks: number; completedTasks: number; attendanceRate: number };
      activities: Array<{ id: string; title: string; description: string; date: string; type: string }>;
    }>;
  }
  const db = await createUteroAcademyServiceRoleClient();

  const results = await Promise.all([
    db.from("intern_profiles").select("*", { count: "exact", head: true }).eq("status", "active"),
    db.from("schools").select("*", { count: "exact", head: true }),
    db.from("task_cards").select("*", { count: "exact", head: true }),
    db.from("task_cards").select("id, task_lists!inner(name)", { count: "exact", head: true }).eq("task_lists.name", "Done"),
    db.from("attendances").select("id, intern_id, check_in_at, check_out_at, status, attendance_date, intern_profiles(full_name)").order("created_at", { ascending: false }).limit(10)
  ]);

  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const [interns, schools, tasks, completed, attendances] = results;
  const totalInterns = interns.count;
  const totalSchools = schools.count;
  const totalTasks = tasks.count;
  const completedTasks = completed.count;
  const recentAttendances = attendances.data;

  // Aggregate attendance rate using simple heuristic (total valid vs total logs)
  const { data: allAttendances } = await db.from("attendances").select("attendance_type, status").limit(5000);
  let attendanceRate = 100;
  if (allAttendances && allAttendances.length > 0) {
    const presentCount = allAttendances.filter(a => a.attendance_type === "present" && (a.status === "valid" || a.status === "pending")).length;
    attendanceRate = Math.round((presentCount / allAttendances.length) * 100);
  }

  // Activity stream (mix of recent attendances and generic activities)
  const activities = (recentAttendances || []).map(att => {
    const profileObj: any = Array.isArray(att.intern_profiles) ? att.intern_profiles[0] : att.intern_profiles;
    return {
      id: att.id,
      title: `${profileObj?.full_name || 'Peserta'} melakukan absensi`,
      description: att.check_in_at ? `Check-in tercatat pada ${new Date(att.check_in_at).toLocaleTimeString("id-ID", {hour:"2-digit", minute:"2-digit"})}` : "Absen status pending",
      date: att.attendance_date,
      type: "attendance"
    };
  });

  return {
    metrics: {
      totalInterns: totalInterns || 0,
      totalSchools: totalSchools || 0,
      totalTasks: totalTasks || 0,
      completedTasks: completedTasks || 0,
      attendanceRate
    },
    activities
  };
}
