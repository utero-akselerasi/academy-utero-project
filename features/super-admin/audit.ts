import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

export async function writeAuditLog(
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string | null = null,
  previousValue: any = null,
  nextValue: any = null,
  metadata: any = {}
) {
  try {
    const db = await createUteroAcademyServiceRoleClient();
    const { error } = await db.from("audit_logs").insert({
      actor_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      previous_value: previousValue,
      next_value: nextValue,
      metadata: metadata,
    });
    if (error) {
      console.error("Gagal menyimpan audit log:", error);
    }
  } catch (err) {
    console.error("Kesalahan menulis audit log:", err);
  }
}

export async function getAuditLogs() {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("audit_logs")
    .select(`
      id,
      actor_id,
      action,
      resource_type,
      resource_id,
      previous_value,
      next_value,
      metadata,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { data: [], error };
  }

  const { data: userProfiles } = await db
    .from("user_profiles")
    .select("id, full_name");

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach((p) => profilesMap.set(p.id, p));
  }

  const mapped = data.map((log: any) => {
    const p = profilesMap.get(log.actor_id);
    return {
      ...log,
      actor_name: p?.full_name || "Sistem / Anonim",
    };
  });

  return { data: mapped, error: null };
}
