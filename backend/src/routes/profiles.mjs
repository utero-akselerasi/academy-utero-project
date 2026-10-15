import { requireIdentity, requirePermission } from "../auth/identity.mjs";
import { parseGeneralProfile, parseInternProfile } from "../profiles/input.mjs";

export async function profileRoutes(app, options) {
  const { db } = options;

  app.get("/v1/profile", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const result = await db.transaction(identity, async (client) => {
      const [profile, intern, mentor, roles, convertedApplication] = await Promise.all([
        client.query("select * from utero_academy.user_profiles where id = $1", [identity.id]),
        client.query(
          `select id, full_name, phone, major, grade_or_semester, school_name,
                  status, start_date, end_date,
                  address, school_supervisor_name, school_supervisor_phone,
                  emergency_contact_name, emergency_contact_phone
           from utero_academy.intern_profiles where user_id = $1`,
          [identity.id],
        ),
        client.query("select * from utero_academy.mentor_profiles where user_id = $1", [identity.id]),
        client.query(
          `select r.code, r.name from utero_academy.user_roles ur
           join utero_academy.roles r on r.id = ur.role_id
           where ur.user_id = $1 and r.is_assignable
             and r.code in ('super_admin', 'admin', 'school', 'intern', 'applicant')
           order by r.code`,
          [identity.id],
        ),
        client.query("select utero_academy.has_converted_application() as converted"),
      ]);
      return { profile: profile.rows[0], internProfile: intern.rows[0] || null, mentorProfile: mentor.rows[0] || null, roles: roles.rows,
        convertedApplication: Boolean(convertedApplication.rows[0]?.converted) };
    });
    if (!result.profile) return reply.code(404).send({ error: "profile_not_found" });
    return result;
  });

  app.get("/v1/profile/staff-scope", async (request, reply) => {
    const identity = requirePermission(request, reply, ["interns.read"]);
    if (!identity) return;
    if (identity.roles.includes("super_admin")) return { kind: "global" };
    return db.transaction(identity, async (client) => {
      const mentor = await client.query("select id from utero_academy.mentor_profiles where user_id = $1", [identity.id]);
      if (!mentor.rows[0]) return { kind: "setup_required" };
      const assignments = await client.query(
        `select distinct intern_id from utero_academy.mentor_assignments
         where mentor_id = $1 and started_at <= (now() at time zone 'Asia/Jakarta')::date
           and (ended_at is null or ended_at >= (now() at time zone 'Asia/Jakarta')::date)`,
        [mentor.rows[0].id],
      );
      return { kind: "scoped", internIds: assignments.rows.map((row) => row.intern_id) };
    });
  });

  app.patch("/v1/profile", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const updated = await db.transaction(identity, async (client) => {
      const [internResult, mentorResult] = await Promise.all([
        client.query("select id from utero_academy.intern_profiles where user_id = $1", [identity.id]),
        client.query("select id from utero_academy.mentor_profiles where user_id = $1", [identity.id]),
      ]);
      if (internResult.rows[0]) {
        const profile = parseInternProfile(request.body);
        if (!profile) return false;
        await client.query(
          `select utero_academy.update_own_intern_biodata($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [profile.fullName, profile.phone, profile.major, profile.gradeOrSemester, profile.schoolName,
            profile.address, profile.schoolSupervisorName, profile.schoolSupervisorPhone,
            profile.emergencyContactName, profile.emergencyContactPhone, profile.avatarPath],
        );
        return true;
      }
      const profile = parseGeneralProfile(request.body);
      if (!profile) return false;
      await client.query(
        `update utero_academy.user_profiles
         set full_name = $2, phone = $3, avatar_path = coalesce($4, avatar_path), updated_at = now()
         where id = $1`,
        [identity.id, profile.fullName, profile.phone, profile.avatarPath],
      );
      if (mentorResult.rows[0]) {
        await client.query(
          "update utero_academy.mentor_profiles set headline = $2, bio = $3, updated_at = now() where id = $1",
          [mentorResult.rows[0].id, profile.headline, profile.bio],
        );
      }
      return true;
    });
    if (!updated) return reply.code(400).send({ error: "invalid_profile" });
    return { ok: true };
  });

  app.get("/v1/interns/:id", async (request, reply) => {
    const identity = requirePermission(request, reply, ["interns.read"]);
    if (!identity) return;
    if (!/^[a-f0-9-]{36}$/i.test(request.params.id)) return reply.code(400).send({ error: "invalid_intern_id" });
    const result = await db.transaction(identity, (client) => client.query(
      `select id, user_id, school_id, full_name, email, phone, major, status, start_date, end_date
       from utero_academy.intern_profiles where id = $1`,
      [request.params.id],
    ));
    if (!result.rows[0]) return reply.code(404).send({ error: "intern_not_found" });
    return { intern: result.rows[0] };
  });
}
