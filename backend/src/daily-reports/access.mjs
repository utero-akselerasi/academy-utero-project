import { activeInternProfile, staffScope } from "../attendance/access.mjs";

export { activeInternProfile };

export async function reportReadScope(client, identity, requestedInternId) {
  if (identity.roles.includes("intern")) {
    const ownId = await activeInternProfile(client, identity);
    if (!ownId || (requestedInternId && requestedInternId !== ownId)) return null;
    return [ownId];
  }
  if (identity.roles.includes("school")) {
    const rows = await client.query(
      `select ip.id from utero_academy.intern_profiles ip join utero_academy.school_contacts sc on sc.school_id = ip.school_id
       where sc.user_id = $1 and ($2::uuid is null or ip.id = $2)`, [identity.id, requestedInternId || null],
    );
    return rows.rows.map((row) => row.id);
  }
  if (!identity.permissions.includes("daily_reports.review") && !identity.roles.includes("super_admin")) return undefined;
  const scope = await staffScope(client, identity);
  if (scope === undefined) return [];
  if (requestedInternId) return scope === null || scope.includes(requestedInternId) ? [requestedInternId] : null;
  return scope === null ? { global: true } : scope;
}
