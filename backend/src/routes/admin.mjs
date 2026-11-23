import { requireRolePermission } from "../auth/identity.mjs";
import { UUID } from "../super-admin/roles.mjs";

function admin(request, reply, permission) {
  return requireRolePermission(request, reply, ["admin", "super_admin"], [permission]);
}

function programFields(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const sourceSlug = typeof body?.slug === "string" && body.slug.trim()
    ? body.slug.trim()
    : name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const slug = sourceSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim() : "internship";
  const status = body?.status ?? "draft";
  if (name.length < 3 || name.length > 150 || !slug || slug.length > 180 || description.length > 5000
    || !type || type.length > 80 || !["draft", "published", "archived"].includes(status)) return null;
  return { name, slug, description: description || null, type, status };
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

  app.get("/v1/admin/programs", async (request, reply) => {
    const identity = admin(request, reply, "programs.manage");
    if (!identity) return;
    return db.transaction(identity, async (client) => ({
      programs: (await client.query("select id,name,slug,description,type,status,created_at,updated_at from utero_academy.programs order by updated_at desc, name")).rows,
    }));
  });

  app.post("/v1/admin/programs", async (request, reply) => {
    const identity = admin(request, reply, "programs.manage");
    if (!identity) return;
    const program = programFields(request.body);
    if (!program) return reply.code(400).send({ error: "invalid_program" });
    try {
      const result = await db.transaction(identity, async (client) => {
        const created = (await client.query(
          "insert into utero_academy.programs(name,slug,description,type,status) values($1,$2,$3,$4,$5) returning id,name,slug,description,type,status,created_at,updated_at",
          [program.name, program.slug, program.description, program.type, program.status],
        )).rows[0];
        await client.query("select utero_academy.append_audit_log($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)", [
          "create_program", "programs", created.id, null, JSON.stringify(program), "{}",
        ]);
        return created;
      });
      return reply.code(201).send({ program: result });
    } catch (error) {
      if (error?.code === "23505") return reply.code(409).send({ error: "program_slug_taken" });
      throw error;
    }
  });

  app.patch("/v1/admin/programs/:id", async (request, reply) => {
    const identity = admin(request, reply, "programs.manage");
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    const program = programFields(request.body);
    if (!program) return reply.code(400).send({ error: "invalid_program" });
    try {
      const result = await db.transaction(identity, async (client) => {
        const updated = (await client.query(
          "update utero_academy.programs set name=$2,slug=$3,description=$4,type=$5,status=$6 where id=$1 returning id,name,slug,description,type,status,created_at,updated_at",
          [request.params.id, program.name, program.slug, program.description, program.type, program.status],
        )).rows[0];
        if (!updated) return null;
        await client.query("select utero_academy.append_audit_log($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)", [
          "update_program", "programs", updated.id, null, JSON.stringify(program), "{}",
        ]);
        return updated;
      });
      if (!result) return reply.code(404).send({ error: "program_not_found" });
      return { program: result };
    } catch (error) {
      if (error?.code === "23505") return reply.code(409).send({ error: "program_slug_taken" });
      throw error;
    }
  });

  app.get("/v1/admin/applications", async (request, reply) => {
    const identity = admin(request, reply, "applications.read");
    if (!identity) return;
    return db.transaction(identity, async (client) => ({ applications: (await client.query(`select a.id,a.full_name,a.email,a.phone,a.school_name,a.major,a.motivation,a.status,a.selection_status,a.onboarding_status,
      a.proposed_start_date,a.proposed_end_date,a.approved_start_date,a.approved_end_date,a.applicant_user_id,a.converted_intern_id,a.cv_path,a.portfolio_path,a.school_letter_path,a.proposal_path,a.created_at,coalesce(a.photo_path,up.avatar_path) as avatar_path
      from utero_academy.internship_applications a left join utero_academy.user_profiles up on up.id=a.applicant_user_id order by a.created_at desc`)).rows }));
  });

  app.get("/v1/admin/applications/:id/selection", async (request, reply) => {
    const identity = admin(request, reply, "applications.review");
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    return db.transaction(identity, async (client) => ({ assignments: (await client.query(`
      select s.id, s.status, s.assigned_at, p.title,
        t.status as attempt_status, t.started_at, t.submitted_at, t.expires_at
      from utero_academy.selection_assignments s
      join utero_academy.selection_test_packages p on p.id = s.package_id
      left join lateral (
        select status, started_at, submitted_at, expires_at
        from utero_academy.selection_attempts
        where assignment_id = s.id
        order by attempt_number desc limit 1
      ) t on true
      where s.application_id = $1 order by s.assigned_at desc`, [request.params.id])).rows }));
  });

  app.patch("/v1/admin/applications/:id/status", async (request, reply) => {
    const identity = admin(request, reply, "applications.review");
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    const { status, startDate, endDate } = request.body || {};
    if (!["reviewed", "accepted", "rejected", "cancelled"].includes(status)) return reply.code(400).send({ error: "invalid_status" });
    try {
      return await db.transaction(identity, async (client) => {
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
    } catch (error) {
      if (status === "accepted" && error?.code === "P0001" && error.message === "Peserta belum dinyatakan lolos seleksi") {
        return reply.code(409).send({ error: "selection_not_passed" });
      }
      throw error;
    }
  });

  app.post("/v1/admin/applications/:id/approve-onboarding", async (request, reply) => {
    const identity = admin(request, reply, "interns.manage");
    if (!identity) return;
    if (!UUID.test(request.params.id || "")) return reply.code(400).send({ error: "invalid_id" });
    return db.transaction(identity, async (client) => ({ id: (await client.query("select utero_academy.approve_application_onboarding($1) id", [request.params.id])).rows[0].id }));
  });

  app.get("/v1/admin/interns", async (request, reply) => {
    const identity = admin(request, reply, "interns.read");
    if (!identity) return;
    return db.transaction(identity, async (client) => {
      const interns = await client.query("select id,full_name,email,major,status from utero_academy.intern_profiles where status='active' order by full_name");
      return { interns: interns.rows };
    });
  });
}
