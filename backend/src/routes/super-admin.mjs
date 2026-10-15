import { requireIdentity } from "../auth/identity.mjs";
import { assignRole, removeRole, UUID } from "../super-admin/roles.mjs";
import { hashPassword } from "../auth/password.mjs";
import { inviteAccount } from "../auth/invitation.mjs";
import { inviteImportedUser } from "../auth/activation.mjs";
import { sendInvitationEmail } from "../auth/email.mjs";
import { parseSignup } from "../auth/signup.mjs";

const ACTIVE_ROLES = new Set(["super_admin", "admin", "school", "intern", "applicant"]);
const INTERN_STATUSES = new Set(["pending", "active", "paused", "completed", "failed", "alumni"]);
const PARTNER_STATUSES = new Set(["prospect", "verified", "active_partner", "suspended", "ended"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value, max, { required = false } = {}) {
  if (value === null || value === undefined || value === "") return required ? null : "";
  if (typeof value !== "string") return null;
  const result = value.trim().replace(/\s+/g, " ");
  return result.length && result.length <= max ? result : null;
}

function nullableText(value, max) {
  const result = cleanText(value, max);
  return result === "" ? null : result;
}

async function setActor(client, identity) {
  await client.query("select set_config('app.user_id',$1,true)", [identity.id]);
  await client.query("select set_config('app.user_roles',$1,true)", [JSON.stringify(identity.roles)]);
}

async function audit(client, action, type, resourceId, previous = null, next = null, metadata = {}) {
  await client.query("select utero_academy.append_audit_log($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)", [
    action, type, resourceId, previous && JSON.stringify(previous), next && JSON.stringify(next), JSON.stringify(metadata),
  ]);
}

function superAdmin(request, reply) {
  const identity = requireIdentity(request, reply);
  if (!identity) return null;
  if (!identity.roles.includes("super_admin")) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return identity;
}

export async function superAdminRoutes(app, { db, config }) {
  app.post("/v1/super-admin/users/:id/activate", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
    const identity = superAdmin(request, reply);
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    const result = await inviteImportedUser(db, config, request.params.id, async (smtpConfig, email, token) => {
      try { await sendInvitationEmail(smtpConfig, email, token); }
      catch (error) {
        request.log.error({ err: error }, "imported user activation delivery failed");
        throw Object.assign(new Error("activation delivery failed"), { code: "email_delivery_failed" });
      }
    });
    return reply.code(result.status).send(result);
  });
  app.get("/v1/super-admin/schools", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    return db.transaction(identity, async (client) => {
      const [schools, contacts, interns] = await Promise.all([
        client.query("select id,name,type,city,province,address,logo_path,created_at,partner_status,referral_code,referral_quota,referral_expires_at from utero_academy.schools order by name"),
        client.query("select sc.id,sc.school_id,sc.user_id,sc.name,sc.email,sc.phone,sc.position,json_build_object('name',s.name) as schools from utero_academy.school_contacts sc left join utero_academy.schools s on s.id=sc.school_id"),
        client.query("select id,user_id,full_name,email,major,status,school_id,start_date,end_date,grade_or_semester from utero_academy.intern_profiles order by full_name"),
      ]);
      return { schools: schools.rows.map((school) => ({ ...school, contacts_count: contacts.rows.filter((contact) => contact.school_id === school.id).length, interns_count: interns.rows.filter((intern) => intern.school_id === school.id).length })), contacts: contacts.rows, interns: interns.rows, unassignedInterns: interns.rows.filter((intern) => !intern.school_id) };
    });
  });

  app.get("/v1/super-admin/diagnostics", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    return db.transaction(identity, async (client) => {
      const [contacts, interns, schools, users, roles, profiles, mentors] = await Promise.all([
        client.query("select id,user_id,school_id,name from utero_academy.school_contacts"),
        client.query("select id,user_id,school_id,full_name from utero_academy.intern_profiles"),
        client.query("select id,name from utero_academy.schools"),
        client.query("select id from auth.users where deleted_at is null"),
        client.query("select ur.user_id,r.code from utero_academy.user_roles ur join utero_academy.roles r on r.id=ur.role_id"),
        client.query("select id,full_name from utero_academy.user_profiles"),
        client.query("select user_id from utero_academy.mentor_profiles"),
      ]);
      const schoolIds = new Set(schools.rows.map((row) => row.id));
      const userIds = new Set(users.rows.map((row) => row.id));
      const orphanContacts = contacts.rows.filter((row) => !row.user_id || !userIds.has(row.user_id));
      const orphanInterns = interns.rows.filter((row) => row.school_id && !schoolIds.has(row.school_id));
      const schoolContactsWithoutSchool = contacts.rows.filter((row) => !schoolIds.has(row.school_id));
      const internUsers = new Set(interns.rows.map((row) => row.user_id));
      const mentorUsers = new Set(mentors.rows.map((row) => row.user_id));
      const names = new Map(profiles.rows.map((row) => [row.id, row.full_name]));
      const missing = [];
      const seen = new Set();
      for (const row of roles.rows) {
        const table = row.code === "intern" && !internUsers.has(row.user_id) ? "intern_profiles" : ["admin", "admin_academy", "mentor"].includes(row.code) && !mentorUsers.has(row.user_id) ? "mentor_profiles" : null;
        if (!table || seen.has(`${row.user_id}:${table}`)) continue;
        seen.add(`${row.user_id}:${table}`);
        missing.push({ userId: row.user_id, fullName: names.get(row.user_id) || "(tanpa profil dasar)", roleCode: row.code, table });
      }
      return { orphanContacts, orphanInterns, schoolContactsWithoutSchool, missing };
    });
  });
  app.post("/v1/super-admin/schools/:id/invite", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    if (!UUID.test(request.params.id) || !UUID.test(request.body?.contactId || "")) return reply.code(400).send({ error: "invalid_id" });
    const contact = await db.transaction(identity, async (client) => (await client.query(
      "select name,email,school_id from utero_academy.school_contacts where id=$1 and school_id=$2", [request.body.contactId, request.params.id])).rows[0]);
    if (!contact?.email) return reply.code(404).send({ error: "contact_not_found" });
    const result = await inviteAccount(db, config, request.log, { email: contact.email, fullName: contact.name, role: "school", schoolId: contact.school_id });
    return reply.code(result.status).send(result);
  });
  app.post("/v1/super-admin/users/:id/reset-password", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const identity = superAdmin(request, reply);
    if (!identity) return;
    if (!UUID.test(request.params.id) || typeof request.body?.password !== "string" || request.body.password.length < 12 || request.body.password.length > 128) {
      return reply.code(400).send({ error: "invalid_password" });
    }
    const passwordHash = await hashPassword(request.body.password);
    const updated = await db.apiTransaction(async (client) => {
      const account = (await client.query("select email_confirmed_at,encrypted_password from auth.users where id=$1 and deleted_at is null for update", [request.params.id])).rows[0];
      if (!account) return { status: 404, error: "user_not_found" };
      if (!account.email_confirmed_at && !account.encrypted_password) return { status: 409, error: "activation_required" };
      const result = await client.query("update auth.users set encrypted_password=$2,updated_at=now() where id=$1 and deleted_at is null returning id", [request.params.id, passwordHash]);
      if (!result.rowCount) return false;
      await client.query("update auth.sessions set revoked_at=now() where user_id=$1 and revoked_at is null", [request.params.id]);
      await client.query("select set_config('app.user_id',$1,true)", [identity.id]);
      await client.query("select set_config('app.user_roles',$1,true)", [JSON.stringify(identity.roles)]);
      await client.query("set local role authenticated");
      await client.query("select utero_academy.append_audit_log($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)", ["reset_password", "auth.users", request.params.id, null, null, "{}"]);
      return true;
    });
    return updated === true ? { ok: true } : reply.code(updated.status).send({ error: updated.error });
  });
  app.get("/v1/super-admin/users", async (request, reply) => {
    const identity = superAdmin(request, reply);
    if (!identity) return;
    return db.transaction(identity, async (client) => {
      const [profiles, roles, userRoles, schools] = await Promise.all([
      client.query(`select p.id, p.full_name, p.phone, p.is_active, p.created_at,
         u.email, u.last_sign_in_at, (u.id is not null) as auth_linked,
         (u.id is not null and u.email_confirmed_at is null and u.encrypted_password is null) as activation_pending,
         (select s.name from utero_academy.school_contacts sc join utero_academy.schools s on s.id = sc.school_id
          where sc.user_id = p.id order by sc.id limit 1) as school_name
         from utero_academy.user_profiles p left join auth.users u on u.id = p.id order by p.created_at desc`),
      client.query(`select id, code, name, description from utero_academy.roles
         where is_assignable and code = any($1::text[]) order by name`,
        [["super_admin", "admin", "school", "intern", "applicant"]]),
      client.query(`select ur.id, ur.user_id, ur.role_id, json_build_object('code', r.code, 'name', r.name) as roles
         from utero_academy.user_roles ur join utero_academy.roles r on r.id = ur.role_id`),
      client.query("select id, name from utero_academy.schools order by name"),
    ]);
    return { profiles: profiles.rows, roles: roles.rows, userRoles: userRoles.rows, schools: schools.rows };
    });
  });

  app.get("/v1/super-admin/users/:id/intern", async (request, reply) => {
    const identity = superAdmin(request, reply);
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    const result = await db.transaction(identity, async (client) => {
      const [profile, intern] = await Promise.all([
        client.query(
          "select id,full_name,phone,avatar_path,is_active,created_at,updated_at from utero_academy.user_profiles where id=$1",
          [request.params.id],
        ),
        client.query(
          `select ip.id,ip.user_id,ip.full_name,ip.email,ip.phone,ip.major,ip.status,ip.created_at,
                  json_build_object('name',s.name) as schools
             from utero_academy.intern_profiles ip
             left join utero_academy.schools s on s.id=ip.school_id
            where ip.user_id=$1`,
          [request.params.id],
        ),
      ]);
      return { userProfile: profile.rows[0] ?? null, internProfile: intern.rows[0] ?? null };
    });
    if (!result.userProfile) return reply.code(404).send({ error: "user_not_found" });
    return result;
  });

  app.post("/v1/super-admin/users", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const parsed = parseSignup(request.body);
    const roleId = request.body?.roleId;
    const phone = nullableText(request.body?.phone, 50);
    if (parsed.error || !UUID.test(roleId || "") || phone === null && request.body?.phone) return reply.code(400).send({ error: "invalid_user" });
    const passwordHash = await hashPassword(parsed.value.password);
    try {
      const result = await db.apiTransaction(async (client) => {
        await setActor(client, identity);
        await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [parsed.value.email]);
        const role = (await client.query("select id,code from utero_academy.roles where id=$1 and is_assignable", [roleId])).rows[0];
        if (!role || !ACTIVE_ROLES.has(role.code)) return { status: 400, error: "invalid_role" };
        const existing = await client.query("select 1 from auth.users where lower(email)=$1 and deleted_at is null", [parsed.value.email]);
        if (existing.rowCount) return { status: 409, error: "account_unavailable" };
        const user = (await client.query(`insert into auth.users(email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
          values($1,$2,now(),$3::jsonb,$4::jsonb) returning id`, [parsed.value.email, passwordHash,
          JSON.stringify({ provider: "email", providers: ["email"] }), JSON.stringify({ full_name: parsed.value.fullName, source_app: "utero_academy" })])).rows[0];
        await client.query("insert into auth.identities(id,user_id,provider_id,identity_data,provider) values($1,$2,$1,$3::jsonb,'email')", [user.id, user.id,
          JSON.stringify({ sub: user.id, email: parsed.value.email, email_verified: true })]);
        await client.query("insert into utero_academy.user_profiles(id,full_name,phone,is_active) values($1,$2,$3,true)", [user.id, parsed.value.fullName, phone]);
        await client.query("insert into utero_academy.user_roles(user_id,role_id) values($1,$2)", [user.id, role.id]);
        if (role.code === "intern") await client.query("insert into utero_academy.intern_profiles(user_id,full_name,email,phone,status) values($1,$2,$3,$4,'active')", [user.id, parsed.value.fullName, parsed.value.email, phone]);
        if (role.code === "admin") await client.query("insert into utero_academy.mentor_profiles(user_id) values($1) on conflict(user_id) do nothing", [user.id]);
        await audit(client, "create_user", "user_profiles", user.id, null, { email: parsed.value.email, fullName: parsed.value.fullName, roleId, roleCode: role.code });
        return { status: 201, id: user.id };
      });
      return reply.code(result.status).send(result);
    } catch (error) {
      if (error?.code === "23505") return reply.code(409).send({ error: "account_unavailable" });
      throw error;
    }
  });

  app.patch("/v1/super-admin/users/:id", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const fullName = cleanText(request.body?.fullName, 150, { required: true });
    const phone = nullableText(request.body?.phone, 50);
    if (!UUID.test(request.params.id || "") || !fullName || (phone === null && request.body?.phone) || typeof request.body?.isActive !== "boolean") return reply.code(400).send({ error: "invalid_user" });
    return db.transaction(identity, async (client) => {
      const previous = (await client.query("select full_name,phone,is_active from utero_academy.user_profiles where id=$1 for update", [request.params.id])).rows[0];
      if (!previous) return reply.code(404).send({ error: "user_not_found" });
      await client.query("update utero_academy.user_profiles set full_name=$2,phone=$3,is_active=$4,updated_at=now() where id=$1", [request.params.id, fullName, phone, request.body.isActive]);
      await client.query("update utero_academy.intern_profiles set full_name=$2,phone=$3,updated_at=now() where user_id=$1", [request.params.id, fullName, phone]);
      await audit(client, "update_user", "user_profiles", request.params.id, previous, { fullName, phone, isActive: request.body.isActive });
      return { id: request.params.id };
    });
  });

  app.delete("/v1/super-admin/users/:id", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    if (request.params.id === identity.id) return reply.code(409).send({ error: "cannot_delete_self" });
    const deleted = await db.apiTransaction(async (client) => {
      await setActor(client, identity);
      const user = (await client.query("select id,email from utero_academy.delete_auth_user($1)", [request.params.id])).rows[0];
      if (!user) return false;
      await audit(client, "delete_user", "auth.users", request.params.id, { email: user.email });
      return true;
    });
    return deleted ? { id: request.params.id } : reply.code(404).send({ error: "user_not_found" });
  });

  app.put("/v1/super-admin/users/:id/school-contact", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const schoolId = request.body?.schoolId;
    const position = nullableText(request.body?.position, 150) || "Perwakilan Instansi";
    if (!UUID.test(request.params.id || "") || (schoolId !== null && schoolId !== "" && !UUID.test(schoolId || ""))) return reply.code(400).send({ error: "invalid_contact" });
    return db.transaction(identity, async (client) => {
      const profile = (await client.query("select p.full_name,p.phone,u.email from utero_academy.user_profiles p join auth.users u on u.id=p.id and u.deleted_at is null where p.id=$1", [request.params.id])).rows[0];
      if (!profile) return reply.code(404).send({ error: "user_not_found" });
      if (schoolId) {
        const school = await client.query("select 1 from utero_academy.schools where id=$1", [schoolId]);
        if (!school.rowCount) return reply.code(404).send({ error: "school_not_found" });
      }
      const previous = (await client.query("delete from utero_academy.school_contacts where user_id=$1 returning id,school_id,position", [request.params.id])).rows;
      if (schoolId) await client.query("insert into utero_academy.school_contacts(user_id,school_id,name,email,phone,position) values($1,$2,$3,$4,$5,$6)", [request.params.id, schoolId, profile.full_name, profile.email, profile.phone, position]);
      await audit(client, "link_school_contact", "school_contacts", request.params.id, previous, { schoolId: schoolId || null, position });
      return { linked: Boolean(schoolId) };
    });
  });

  app.post("/v1/super-admin/schools", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const name = cleanText(request.body?.name, 200, { required: true });
    const values = [nullableText(request.body?.type, 100), nullableText(request.body?.city, 150), nullableText(request.body?.province, 150), nullableText(request.body?.address, 2000), nullableText(request.body?.logoPath, 1000)];
    if (!name || values.some((value, index) => value === null && [request.body?.type, request.body?.city, request.body?.province, request.body?.address, request.body?.logoPath][index])) return reply.code(400).send({ error: "invalid_school" });
    const row = await db.transaction(identity, async (client) => { const school = (await client.query("insert into utero_academy.schools(name,type,city,province,address,logo_path) values($1,$2,$3,$4,$5,$6) returning id", [name, ...values])).rows[0]; await audit(client, "create_school", "schools", school.id, null, { name, type: values[0], city: values[1], province: values[2], address: values[3], logoPath: values[4] }); return school; });
    return reply.code(201).send(row);
  });

  app.patch("/v1/super-admin/schools/:id", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const name = cleanText(request.body?.name, 200, { required: true });
    const values = [nullableText(request.body?.type, 100), nullableText(request.body?.city, 150), nullableText(request.body?.province, 150), nullableText(request.body?.address, 2000), nullableText(request.body?.logoPath, 1000)];
    const rawValues = [request.body?.type, request.body?.city, request.body?.province, request.body?.address, request.body?.logoPath];
    if (!UUID.test(request.params.id || "") || !name || values.some((value, index) => value === null && rawValues[index])) return reply.code(400).send({ error: "invalid_school" });
    return db.transaction(identity, async (client) => { const previous = (await client.query("select name,type,city,province,address,logo_path from utero_academy.schools where id=$1 for update", [request.params.id])).rows[0]; if (!previous) return reply.code(404).send({ error: "school_not_found" }); await client.query("update utero_academy.schools set name=$2,type=$3,city=$4,province=$5,address=$6,logo_path=$7,updated_at=now() where id=$1", [request.params.id, name, ...values]); await audit(client, "update_school", "schools", request.params.id, previous, { name, type: values[0], city: values[1], province: values[2], address: values[3], logoPath: values[4] }); return { id: request.params.id }; });
  });

  app.patch("/v1/super-admin/schools/:id/partnership", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const { partnerStatus } = request.body || {};
    const referralCode = typeof request.body?.referralCode === "string" ? request.body.referralCode.trim().toUpperCase() : "";
    const quota = request.body?.referralQuota === "" || request.body?.referralQuota === null ? null : Number(request.body?.referralQuota);
    const expires = request.body?.referralExpiresAt || null;
    if (!UUID.test(request.params.id || "") || !PARTNER_STATUSES.has(partnerStatus) || (referralCode && !/^[A-Z0-9-]{6,32}$/.test(referralCode)) || (quota !== null && (!Number.isInteger(quota) || quota < 1 || quota > 100000)) || (expires && !DATE.test(expires))) return reply.code(400).send({ error: "invalid_partnership" });
    return db.transaction(identity, async (client) => { const previous = (await client.query("select partner_status,referral_code,referral_quota,referral_expires_at from utero_academy.schools where id=$1 for update", [request.params.id])).rows[0]; if (!previous) return reply.code(404).send({ error: "school_not_found" }); const verified = ["verified", "active_partner"].includes(partnerStatus); await client.query("update utero_academy.schools set partner_status=$2,referral_code=$3,referral_quota=$4,referral_expires_at=$5::date + time '23:59:59',verified_by=$6,verified_at=$7,updated_at=now() where id=$1", [request.params.id, partnerStatus, referralCode || null, quota, expires, verified ? identity.id : null, verified ? new Date() : null]); await audit(client, "update_school_partnership", "schools", request.params.id, previous, { partnerStatus, referralCode, referralQuota: quota, referralExpiresAt: expires }); return { id: request.params.id }; });
  });

  app.delete("/v1/super-admin/schools/:id", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    const result = await db.transaction(identity, async (client) => { const school = (await client.query("select id from utero_academy.schools where id=$1 for update", [request.params.id])).rows[0]; if (!school) return { status: 404, error: "school_not_found" }; const linked = await client.query("select exists(select 1 from utero_academy.school_contacts where school_id=$1) or exists(select 1 from utero_academy.intern_profiles where school_id=$1) linked", [request.params.id]); if (linked.rows[0].linked) return { status: 409, error: "school_in_use" }; await client.query("delete from utero_academy.schools where id=$1", [request.params.id]); await audit(client, "delete_school", "schools", request.params.id); return { status: 200, id: request.params.id }; });
    return reply.code(result.status).send(result);
  });

  app.put("/v1/super-admin/interns/:id/school", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const schoolId = request.body?.schoolId;
    if (!UUID.test(request.params.id || "") || (schoolId !== null && schoolId !== "" && !UUID.test(schoolId || ""))) return reply.code(400).send({ error: "invalid_id" });
    return db.transaction(identity, async (client) => { const previous = (await client.query("select school_id from utero_academy.intern_profiles where id=$1 for update", [request.params.id])).rows[0]; if (!previous) return reply.code(404).send({ error: "intern_not_found" }); if (schoolId && !(await client.query("select 1 from utero_academy.schools where id=$1", [schoolId])).rowCount) return reply.code(404).send({ error: "school_not_found" }); await client.query("update utero_academy.intern_profiles set school_id=$2,updated_at=now() where id=$1", [request.params.id, schoolId || null]); await audit(client, "link_intern_school", "intern_profiles", request.params.id, previous, { schoolId: schoolId || null }); return { id: request.params.id }; });
  });

  app.patch("/v1/super-admin/interns/:id/period", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const { startDate, endDate, status } = request.body || {};
    const major = nullableText(request.body?.major, 200), grade = nullableText(request.body?.gradeOrSemester, 100);
    if (!UUID.test(request.params.id || "") || (startDate && !DATE.test(startDate)) || (endDate && !DATE.test(endDate)) || (startDate && endDate && endDate < startDate) || !INTERN_STATUSES.has(status) || major === null && request.body?.major || grade === null && request.body?.gradeOrSemester) return reply.code(400).send({ error: "invalid_period" });
    return db.transaction(identity, async (client) => { const previous = (await client.query("select start_date,end_date,major,grade_or_semester,status from utero_academy.intern_profiles where id=$1 for update", [request.params.id])).rows[0]; if (!previous) return reply.code(404).send({ error: "intern_not_found" }); await client.query("update utero_academy.intern_profiles set start_date=$2,end_date=$3,major=$4,grade_or_semester=$5,status=$6,updated_at=now() where id=$1", [request.params.id, startDate || null, endDate || null, major, grade, status]); await audit(client, "update_intern_period", "intern_profiles", request.params.id, previous, { startDate: startDate || null, endDate: endDate || null, major, gradeOrSemester: grade, status }); return { id: request.params.id }; });
  });

  app.post("/v1/super-admin/orphans/cleanup", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    const orphanType = request.body?.orphanType;
    if (!["contacts", "interns", "all"].includes(orphanType)) return reply.code(400).send({ error: "invalid_orphan_type" });
    return db.apiTransaction(async (client) => { await setActor(client, identity); let deletedCount = 0; if (["contacts", "all"].includes(orphanType)) { const contacts = await client.query(`delete from utero_academy.school_contacts sc where sc.user_id is null or not exists(select 1 from auth.users u where u.id=sc.user_id and u.deleted_at is null) or not exists(select 1 from utero_academy.schools s where s.id=sc.school_id) returning id`); deletedCount += contacts.rowCount; } if (["interns", "all"].includes(orphanType)) { const interns = await client.query(`update utero_academy.intern_profiles ip set school_id=null,updated_at=now() where ip.school_id is not null and not exists(select 1 from utero_academy.schools s where s.id=ip.school_id) returning id`); deletedCount += interns.rowCount; } await audit(client, "cleanup_orphan_data", "system", null, null, { orphanType, deletedCount }); return { deletedCount }; });
  });

  app.post("/v1/super-admin/domain-profiles/backfill", async (request, reply) => {
    const identity = superAdmin(request, reply); if (!identity) return;
    return db.transaction(identity, async (client) => {
      const missingProfiles = (await client.query(`select ur.user_id,r.code,p.full_name,p.phone,u.email from utero_academy.user_roles ur join utero_academy.roles r on r.id=ur.role_id join auth.users u on u.id=ur.user_id and u.deleted_at is null left join utero_academy.user_profiles p on p.id=ur.user_id where (r.code='intern' and not exists(select 1 from utero_academy.intern_profiles ip where ip.user_id=ur.user_id)) or (r.code in ('admin','admin_academy','mentor') and not exists(select 1 from utero_academy.mentor_profiles mp where mp.user_id=ur.user_id)) for update of ur`)).rows;
      let created = 0; const failures = [];
      for (const row of missingProfiles) {
        if (row.code === "intern" && !row.full_name) { failures.push({ userId: row.user_id, reason: "Profil dasar user belum ada." }); continue; }
        if (row.code === "intern") await client.query("insert into utero_academy.intern_profiles(user_id,full_name,email,phone,status) values($1,$2,$3,$4,'active') on conflict(user_id) do nothing", [row.user_id, row.full_name, row.email, row.phone]);
        else await client.query("insert into utero_academy.mentor_profiles(user_id) values($1) on conflict(user_id) do nothing", [row.user_id]);
        created += 1;
      }
      await audit(client, "backfill_domain_profiles", "system", null, null, { attempted: missingProfiles.length, created, failed: failures.length, failures });
      return { attempted: missingProfiles.length, created, failures };
    });
  });

  app.post("/v1/super-admin/roles", async (request, reply) => {
    const identity = superAdmin(request, reply);
    if (!identity) return;
    const { userId, roleId } = request.body || {};
    if (!UUID.test(userId || "") || !UUID.test(roleId || "")) return reply.code(400).send({ error: "invalid_id" });
    const result = await assignRole(db, identity, userId, roleId);
    return reply.code(result.status).send(result);
  });

  app.delete("/v1/super-admin/roles/:id", async (request, reply) => {
    const identity = superAdmin(request, reply);
    if (!identity) return;
    if (!UUID.test(request.params.id)) return reply.code(400).send({ error: "invalid_id" });
    const result = await removeRole(db, identity, request.params.id);
    return reply.code(result.status).send(result);
  });

  app.get("/v1/super-admin/audit-logs", async (request, reply) => {
    const identity = superAdmin(request, reply);
    if (!identity) return;
    const result = await db.transaction(identity, (client) => client.query(`select l.*, coalesce(p.full_name, 'Sistem / Anonim') as actor_name
      from utero_academy.audit_logs l left join utero_academy.user_profiles p on p.id = l.actor_id
      order by l.created_at desc limit 500`));
    return { logs: result.rows };
  });
}
