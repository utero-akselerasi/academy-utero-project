import { requireIdentity, requirePermission, requireRolePermission } from "../auth/identity.mjs";
import { activeInternProfile, reportReadScope } from "../daily-reports/access.mjs";
import { parseReport, validId } from "../daily-reports/input.mjs";
import { cleanupObjects, storeDomainObject } from "../attendance/storage.mjs";
import { requireScopedIntern } from "../attendance/access.mjs";

function apiError(reply, status, error) { return reply.code(status).send({ error }); }

export async function dailyReportRoutes(app, { db, config }) {
  app.get("/v1/daily-reports/intern/:id", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    if (!validId(request.params.id)) return apiError(reply, 400, "invalid_intern_id");
    const result = await db.transaction(identity, async (client) => {
      const scope = await reportReadScope(client, identity, request.params.id);
      if (!scope || !Array.isArray(scope) || !scope.includes(request.params.id)) return null;
      const intern = await client.query(
        `select ip.*, json_build_object('name', s.name) schools
         from utero_academy.intern_profiles ip left join utero_academy.schools s on s.id = ip.school_id
         where ip.id = $1`, [request.params.id],
      );
      return intern.rows[0] ?? null;
    });
    if (!result) return apiError(reply, 404, "intern_not_found");
    return { intern: result };
  });

  app.get("/v1/daily-reports/profile", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const result = await db.transaction(identity, async (client) => {
      const [intern, mentor] = await Promise.all([
        client.query("select id from utero_academy.intern_profiles where user_id = $1", [identity.id]),
        client.query("select id from utero_academy.mentor_profiles where user_id = $1", [identity.id]),
      ]);
      return { internProfileId: intern.rows[0]?.id ?? null, mentorProfileId: mentor.rows[0]?.id ?? null };
    });
    return result;
  });

  app.get("/v1/daily-reports", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const requested = request.query?.internId;
    if (requested && !validId(requested)) return apiError(reply, 400, "invalid_intern_id");
    const result = await db.transaction(identity, async (client) => {
      const scope = await reportReadScope(client, identity, requested);
      if (scope === undefined) return undefined;
      if (scope === null) return null;
      const global = !Array.isArray(scope) && scope.global;
      const where = global ? "" : "where dr.intern_id = any($1::uuid[])";
      const values = global ? [] : [scope];
      if (Array.isArray(scope) && scope.length === 0) return [];
      const reports = await client.query(
        `select dr.*, dr.report_date::text as report_date, json_build_object('id',ip.id,'user_id',ip.user_id,'full_name',ip.full_name,
          'user_profiles',json_build_object('full_name',coalesce(up.full_name,ip.full_name))) intern_profiles
         from utero_academy.daily_reports dr join utero_academy.intern_profiles ip on ip.id=dr.intern_id
         left join utero_academy.user_profiles up on up.id=ip.user_id ${where} order by dr.report_date desc`, values,
      );
      if (!reports.rows.length) return [];
      const ids = reports.rows.map((row) => row.id);
      const attachments = await client.query("select * from utero_academy.daily_report_attachments where report_id = any($1::uuid[]) order by created_at", [ids]);
      return reports.rows.map((report) => ({ ...report, daily_report_attachments: attachments.rows.filter((item) => item.report_id === report.id) }));
    });
    if (result === undefined) return apiError(reply, 403, "forbidden");
    if (result === null) return apiError(reply, 404, "intern_not_found");
    return { reports: result };
  });

  app.get("/v1/daily-reports/:id/reviews", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    if (!validId(request.params.id)) return apiError(reply, 400, "invalid_report_id");
    const result = await db.transaction(identity, async (client) => {
      const report = await client.query("select intern_id from utero_academy.daily_reports where id=$1", [request.params.id]);
      if (!report.rows[0]) return null;
      const scope = await reportReadScope(client, identity, report.rows[0].intern_id);
      if (!scope || !scope.includes(report.rows[0].intern_id)) return undefined;
      const reviews = await client.query("select * from utero_academy.daily_report_reviews where report_id=$1 order by created_at desc", [request.params.id]);
      return reviews.rows;
    });
    if (result === null) return apiError(reply, 404, "report_not_found");
    if (result === undefined) return apiError(reply, 403, "forbidden");
    return { reviews: result };
  });

  app.post("/v1/daily-reports", { bodyLimit: 220 * 1024 * 1024 }, async (request, reply) => {
    const identity = requirePermission(request, reply, ["daily_reports.submit"]);
    if (!identity) return;
    const input = parseReport(request.body);
    if (!input) return apiError(reply, 400, "invalid_report");
    const cleanups = [];
    try {
      const result = await db.transaction(identity, async (client) => {
        const internId = await activeInternProfile(client, identity);
        if (!internId) return null;
        let report;
        if (input.reportId) {
          const updated = await client.query(
            `update utero_academy.daily_reports set today_work=$3,progress=$4,blockers=$5,tomorrow_plan=$6,status='submitted',updated_at=now()
             where id=$1 and intern_id=$2 returning *`,
            [input.reportId, internId, input.todayWork, input.progress, input.blockers, input.tomorrowPlan],
          );
          report = updated.rows[0];
          if (!report) return { error: "report_not_found" };
        } else {
          const inserted = await client.query(
            `insert into utero_academy.daily_reports (intern_id,report_date,today_work,progress,blockers,tomorrow_plan,status)
             values ($1,$2,$3,$4,$5,$6,'submitted') returning *`,
            [internId, input.reportDate, input.todayWork, input.progress, input.blockers, input.tomorrowPlan],
          );
          report = inserted.rows[0];
        }
        for (const upload of input.attachments) {
          const filePath = await storeDomainObject({ db, config, identity, bucketName: "daily-report", prefix: report.id, upload, cleanups });
          await client.query(
            "insert into utero_academy.daily_report_attachments (report_id,file_path,file_name,mime_type,size_bytes) values ($1,$2,$3,$4,$5)",
            [report.id, filePath, upload.fileName, upload.mimeType, upload.buffer.length],
          );
        }
        if (input.driveLink) {
          await client.query(
            "insert into utero_academy.daily_report_attachments (report_id,file_path,file_name,mime_type,size_bytes) values ($1,$2,'Link Google Drive','url',null)",
            [report.id, input.driveLink],
          );
        }
        return { report };
      });
      if (!result) { await cleanupObjects(cleanups); return apiError(reply, 409, "intern_profile_inactive"); }
      if (result.error) { await cleanupObjects(cleanups); return apiError(reply, 404, result.error); }
      return reply.code(input.reportId ? 200 : 201).send(result);
    } catch (error) {
      await cleanupObjects(cleanups);
      if (error.code === "23505") return apiError(reply, 409, "report_exists");
      throw error;
    }
  });

  app.patch("/v1/daily-reports/:id/review", async (request, reply) => {
    const identity = requireRolePermission(request, reply, ["admin", "super_admin"], ["daily_reports.review"]);
    if (!identity) return;
    if (!validId(request.params.id) || !["approved", "revision_requested"].includes(request.body?.status)) return apiError(reply, 400, "invalid_review");
    const note = typeof request.body.note === "string" ? request.body.note.trim().slice(0, 5000) || null : null;
    const result = await db.transaction(identity, async (client) => {
      const report = await client.query("select intern_id from utero_academy.daily_reports where id=$1 for update", [request.params.id]);
      if (!report.rows[0]) return "not_found";
      const denied = await requireScopedIntern(client, identity, report.rows[0].intern_id);
      if (denied) return denied;
      const mentor = await client.query("select id from utero_academy.mentor_profiles where user_id=$1", [identity.id]);
      if (!mentor.rows[0]) return "setup_required";
      await client.query("insert into utero_academy.daily_report_reviews (report_id,mentor_id,status,note) values ($1,$2,$3,$4)", [request.params.id, mentor.rows[0].id, request.body.status, note]);
      await client.query("update utero_academy.daily_reports set status=$2,updated_at=now() where id=$1", [request.params.id, request.body.status]);
      return "ok";
    });
    const statuses = { not_found: 404, setup_required: 409, forbidden: 403 };
    if (result !== "ok") return apiError(reply, statuses[result], result);
    return { ok: true };
  });
}
