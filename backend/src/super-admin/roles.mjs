export const ACTIVE_ROLES = new Set(["super_admin", "admin", "school", "intern", "applicant"]);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function assignRole(db, identity, userId, roleId) {
  return db.transaction(identity, async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [userId]);
    const role = (await client.query("select id, code from utero_academy.roles where id = $1 and is_assignable", [roleId])).rows[0];
    if (!role || !ACTIVE_ROLES.has(role.code)) return { status: 400, error: "invalid_role" };
    const user = (await client.query("select id from auth.users where id = $1 and deleted_at is null", [userId])).rows[0];
    if (!user) return { status: 404, error: "user_not_found" };
    let profile;
    if (role.code === "intern") {
      profile = (await client.query("select full_name, phone from utero_academy.user_profiles where id = $1", [userId])).rows[0];
      if (!profile?.full_name) return { status: 422, error: "profile_required" };
    }
    const inserted = await client.query(
      `insert into utero_academy.user_roles (user_id, role_id) values ($1, $2)
       on conflict (user_id, role_id) where scope_type is null and scope_id is null do nothing returning id`,
      [userId, roleId],
    );
    if (!inserted.rows[0]) return { status: 200, unchanged: true };
    if (role.code === "admin") {
      await client.query("insert into utero_academy.mentor_profiles (user_id) values ($1) on conflict (user_id) do nothing", [userId]);
    }
    if (role.code === "intern") {
      await client.query(
        `insert into utero_academy.intern_profiles (user_id, full_name, email, phone, status)
         select $1, $2, email, $3, 'active' from auth.users where id = $1
         on conflict (user_id) do nothing`, [userId, profile.full_name, profile.phone],
      );
    }
    await client.query("select utero_academy.append_audit_log($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
      ["assign_role", "user_roles", userId, null, JSON.stringify({ roleId, roleCode: role.code }), "{}"]);
    return { status: 201, id: inserted.rows[0].id };
  });
}

export async function removeRole(db, identity, assignmentId) {
  return db.transaction(identity, async (client) => {
    const row = (await client.query(
      `select ur.id, ur.user_id, ur.role_id, r.code from utero_academy.user_roles ur
       join utero_academy.roles r on r.id = ur.role_id where ur.id = $1 for update of ur`, [assignmentId],
    )).rows[0];
    if (!row) return { status: 404, error: "assignment_not_found" };
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [row.user_id]);
    if (row.user_id === identity.id && row.code === "super_admin") return { status: 409, error: "cannot_remove_own_super_admin" };
    if (row.code === "super_admin") {
      await client.query("select pg_advisory_xact_lock(47471001)");
      const remaining = await client.query(
        `select count(distinct ur.user_id)::int as total from utero_academy.user_roles ur
         join utero_academy.roles r on r.id = ur.role_id
         join auth.users u on u.id = ur.user_id and u.deleted_at is null
         join utero_academy.user_profiles p on p.id = u.id and p.is_active
         where r.code = 'super_admin'`,
      );
      if (remaining.rows[0].total <= 1) return { status: 409, error: "last_super_admin" };
    }
    await client.query("delete from utero_academy.user_roles where id = $1", [assignmentId]);
    await client.query("select utero_academy.append_audit_log($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
      ["remove_role", "user_roles", row.user_id, JSON.stringify({ roleId: row.role_id, roleCode: row.code, assignmentId }), null, "{}"]);
    return { status: 200, removed: true };
  });
}
