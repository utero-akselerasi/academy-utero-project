import { requireIdentity } from "../auth/identity.mjs";

export const ACTIVE_PARTNER_STATUSES = new Set(["verified", "active_partner"]);

export function requireSchoolIdentity(request, reply) {
  const identity = requireIdentity(request, reply);
  if (!identity) return null;
  if (!identity.roles.includes("school") && !identity.roles.includes("super_admin")) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return identity;
}

export async function resolveSchool(client, identity, { active = false } = {}) {
  const result = await client.query(
    `select s.id, s.name, s.type, s.city, s.province, s.address, s.logo_path, s.partner_status
       from utero_academy.school_contacts sc
       join utero_academy.schools s on s.id = sc.school_id
      where sc.user_id = $1
      limit 2`,
    [identity.id],
  );
  if (result.rowCount !== 1) return { error: "school_contact_required" };
  const school = result.rows[0];
  if (active && !ACTIVE_PARTNER_STATUSES.has(school.partner_status)) return { error: "school_partner_inactive" };
  return { school };
}

export function validId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
