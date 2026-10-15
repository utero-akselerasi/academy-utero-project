import { requireRolePermission } from "../auth/identity.mjs";
import { UUID } from "../super-admin/roles.mjs";

function admin(request, reply, permission) {
  return requireRolePermission(request, reply, ["admin", "super_admin"], [permission]);
}

export async function adminRoutes(app, { db }) {
  app.get("/v1/admin/dashboard", async (request, reply) => {
    const identity = admin(request, reply, "interns.read");
    if (!identity) return;
    return db.transaction(identity, async (client) => {
      const [counts, recentAttendances, attendance] = await Promise.all([
        client.query(`select
          (select count(*)::int from utero_academy.intern_profiles where status='active') total_interns,
          (select count(*)::int from utero_academy.schools) total_schools,
          (select count(*)::int from utero_academy.task_cards) total_tasks,
          (select count(*)::int from utero_academy.task_cards c join utero_academy.task_lists l on l.id=c.list_id where l.name='Done') completed_tasks`),
        client.query(`select a.id,a.check_in_at,a.status,a.attendance_date::text attendance_date,
          coalesce(ip.full_name,'Peserta') full_name
          from utero_academy.attendances a join utero_academy.intern_profiles ip on ip.id=a.intern_id
          order by a.created_at desc limit 10`),
        client.query(`select count(*)::int total,
          count(*) filter(where attendance_type='present' and status in ('valid','pending'))::int present
          from utero_academy.attendances`),
      ]);
      const metrics = counts.rows[0];
      const attendanceRate = attendance.rows[0].total
        ? Math.round((attendance.rows[0].present / attendance.rows[0].total) * 100)
        : 100;
      return {
        metrics: {
          totalInterns: metrics.total_interns,
          totalSchools: metrics.total_schools,
          totalTasks: metrics.total_tasks,
          completedTasks: metrics.completed_tasks,
          attendanceRate,
        },
        activities: recentAttendances.rows.map((row) => ({
          id: row.id,
          title: `${row.full_name} melakukan absensi`,
          description: row.check_in_at
            ? `Check-in tercatat pada ${new Date(row.check_in_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
            : "Absen status pending",
          date: row.attendance_date,
          type: "attendance",
        })),
      };
    });
  });

  app.get("/v1/admin/applications", async (request, reply) => {
    const identity = admin(request, reply, "applications.read");
    if (!identity) return;
    return db.transaction(identity, async (client) => ({ applications: (await client.query(`select id,full_name,email,phone,school_name,major,motivation,status,selection_status,onboarding_status,
      proposed_start_date,proposed_end_date,approved_start_date,approved_end_date,applicant_user_id,converted_intern_id,cv_path,portfolio_path,created_at
      from utero_academy.internship_applications order by created_at desc`)).rows }));
  });

  app.patch("/v1/admin/applications/:id/status", async (request, reply) => {
    const identity = admin(request, reply, "applications.review");
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    const { status, startDate, endDate } = request.body || {};
    if (!["reviewed", "accepted", "rejected", "cancelled"].includes(status)) return reply.code(400).send({ error: "invalid_status" });
    return db.transaction(identity, async (client) => {
      if (status === "accepted") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "") || endDate < startDate) return reply.code(400).send({ error: "invalid_dates" });
        const result = await client.query("select utero_academy.accept_application_as_intern($1,$2,$3) id", [request.params.id, startDate, endDate]);
        return { id: result.rows[0].id };
      }
      const result = await client.query("select utero_academy.review_application($1,$2) id", [request.params.id, status]);
      if (!result.rows[0]?.id) return reply.code(404).send({ error: "application_not_found" });
      await client.query("select utero_academy.append_audit_log($1,$2,$3,$4,$5,$6)", ["update_application_status", "internship_applications", request.params.id, null, JSON.stringify({ status }), "{}"]);
      return { id: request.params.id };
    });
  });

  app.post("/v1/admin/applications/:id/approve-onboarding", async (request, reply) => {
    const identity = admin(request, reply, "interns.manage");
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    return db.transaction(identity, async (client) => ({ id: (await client.query("select utero_academy.approve_application_onboarding($1) id", [request.params.id])).rows[0].id }));
  });

  app.get("/v1/admin/placements", async (request, reply) => {
    const identity = admin(request, reply, "interns.read");
    if (!identity) return;
    return db.transaction(identity, async (client) => {
      const [interns, mentors, assignments] = await Promise.all([
        client.query("select id,full_name,email,major,status from utero_academy.intern_profiles where status='active' order by full_name"),
        client.query(`select mp.id,coalesce(up.full_name,'Mentor') full_name from utero_academy.mentor_profiles mp
          join utero_academy.user_roles ur on ur.user_id=mp.user_id join utero_academy.roles r on r.id=ur.role_id and r.code='admin'
          left join utero_academy.user_profiles up on up.id=mp.user_id order by full_name`),
        client.query(`select ma.id,ma.mentor_id,ma.intern_id,ma.started_at,ma.ended_at,
          json_build_object('id',mp.id,'user_profiles',json_build_object('full_name',coalesce(up.full_name,'Mentor'))) mentor_profiles,
          json_build_object('id',ip.id,'full_name',ip.full_name,'major',ip.major,'email',ip.email,'phone',ip.phone,'school_name',coalesce(s.name,ip.school_name)) intern_profiles
          from utero_academy.mentor_assignments ma join utero_academy.mentor_profiles mp on mp.id=ma.mentor_id
          left join utero_academy.user_profiles up on up.id=mp.user_id join utero_academy.intern_profiles ip on ip.id=ma.intern_id
          left join utero_academy.schools s on s.id=ip.school_id order by ma.created_at desc`),
      ]);
      return { interns: interns.rows, mentors: mentors.rows, assignments: assignments.rows };
    });
  });

  app.post("/v1/admin/placements", async (request, reply) => {
    const identity = admin(request, reply, "mentors.assign");
    if (!identity) return;
    const { internId, mentorId } = request.body || {};
    if (!UUID.test(internId || "") || !UUID.test(mentorId || "")) return reply.code(400).send({ error: "invalid_id" });
    return db.transaction(identity, async (client) => {
      const result = await client.query(`insert into utero_academy.mentor_assignments(intern_id,mentor_id,assigned_by,started_at)
        values($1,$2,$3,(now() at time zone 'Asia/Jakarta')::date) returning id`, [internId, mentorId, identity.id]);
      return reply.code(201).send({ id: result.rows[0].id });
    });
  });

  app.delete("/v1/admin/placements/:id", async (request, reply) => {
    const identity = admin(request, reply, "mentors.assign");
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    return db.transaction(identity, async (client) => {
      const result = await client.query("delete from utero_academy.mentor_assignments where id=$1 returning id", [request.params.id]);
      return result.rowCount ? { id: request.params.id } : reply.code(404).send({ error: "placement_not_found" });
    });
  });
}
