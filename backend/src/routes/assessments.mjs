import { requireIdentity, requirePermission } from "../auth/identity.mjs";
import { requireScopedIntern, staffScope } from "../attendance/access.mjs";
import { parseAssessment, validId } from "../assessments/input.mjs";
import { certificateNumber } from "../certificates/number.mjs";

function apiError(reply, status, error) { return reply.code(status).send({ error }); }

export async function assessmentsRoutes(app, { db }) {
  app.get("/v1/assessments/:internId", async (request, reply) => {
    if (!validId(request.params.internId)) return apiError(reply, 400, "invalid_intern_id");
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const isIntern = identity.roles.includes("intern");
    const isStaff = identity.roles.includes("admin") || identity.roles.includes("super_admin");
    if (!isIntern && !isStaff) return apiError(reply, 403, "forbidden");
    if (identity.roles.includes("admin") && !identity.permissions.includes("assessments.write")) {
      return apiError(reply, 403, "forbidden");
    }
    const result = await db.transaction(identity, async (client) => {
      if (isIntern) {
        const own = await client.query("select id from utero_academy.intern_profiles where user_id=$1", [identity.id]);
        if (own.rows[0]?.id !== request.params.internId) return undefined;
      } else if (isStaff) {
        const scopeError = await requireScopedIntern(client, identity, request.params.internId);
        if (scopeError) return undefined;
      } else return undefined;
      const assessment = await client.query(
        "select id,intern_id,final_score,feedback,status,score,created_at,updated_at from utero_academy.assessments where intern_id=$1",
        [request.params.internId],
      );
      return assessment.rows[0] ?? null;
    });
    if (result === undefined) return apiError(reply, 403, "forbidden");
    return { assessment: result };
  });

  app.get("/v1/assessments/interns", async (request, reply) => {
    const identity = requirePermission(request, reply, ["assessments.write"]);
    if (!identity) return;
    const result = await db.transaction(identity, async (client) => {
      const scope = await staffScope(client, identity);
      if (scope === undefined) return undefined;
      if (Array.isArray(scope) && scope.length === 0) return [];
      const where = scope === null ? "" : "and ip.id = any($1::uuid[])";
      const values = scope === null ? [] : [scope];
      const rows = await client.query(
        `select ip.id,ip.full_name,ip.email,ip.major,ip.status,ip.user_id,
          case when a.id is null then null else json_build_object('id',a.id,'final_score',a.final_score,
            'status',a.status,'feedback',a.feedback,'score',a.score) end assessment
         from utero_academy.intern_profiles ip
         join utero_academy.user_roles ur on ur.user_id=ip.user_id
         join utero_academy.roles r on r.id=ur.role_id and r.code='intern'
         left join utero_academy.assessments a on a.intern_id=ip.id
         where ip.status='active' ${where} order by ip.full_name`, values,
      );
      return rows.rows;
    });
    if (result === undefined) return apiError(reply, 403, "mentor_profile_required");
    return { interns: result };
  });

  app.get("/v1/assessments/settings", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const result = await db.transaction(identity, async (client) => {
      const row = await client.query("select certificate_template_path,check_in_time,check_out_time,late_tolerance_minutes,monthly_target_hours from utero_academy.attendance_settings limit 1");
      return row.rows[0] ?? null;
    });
    return { settings: result };
  });

  app.put("/v1/assessments/:internId", async (request, reply) => {
    if (!validId(request.params.internId)) return apiError(reply, 400, "invalid_intern_id");
    const input = parseAssessment(request.body);
    if (!input) return apiError(reply, 400, "invalid_assessment");
    const required = input.submitType === "finalize"
      ? ["assessments.finalize", "certificates.generate"] : ["assessments.write"];
    const identity = requirePermission(request, reply, required);
    if (!identity) return;
    if (!identity.roles.includes("super_admin") && required.some((code) => !identity.permissions.includes(code))) {
      return apiError(reply, 403, "forbidden");
    }
    const result = await db.transaction(identity, async (client) => {
      const scopeError = await requireScopedIntern(client, identity, request.params.internId);
      if (scopeError) return { error: scopeError };
      const existing = await client.query("select id,status from utero_academy.assessments where intern_id=$1", [request.params.internId]);
      if (existing.rows[0]?.status === "finalized") return { error: "assessment_finalized" };
      const mentor = await client.query("select id from utero_academy.mentor_profiles where user_id=$1", [identity.id]);
      let assessment;
      if (existing.rows[0]) {
        assessment = await client.query(
          `update utero_academy.assessments set score=$2,final_score=$3,feedback=$4,
            status=case when $5 then 'finalized' else status end,
            finalized_by=case when $5 then $6 else finalized_by end,
            finalized_at=case when $5 then now() else finalized_at end,updated_at=now()
           where id=$1 returning *`,
          [existing.rows[0].id, input.score, input.finalScore, input.feedback, input.submitType === "finalize", identity.id],
        );
      } else {
        assessment = await client.query(
          `insert into utero_academy.assessments
            (intern_id,mentor_id,score,final_score,feedback,status,finalized_by,finalized_at)
           values ($1,$2,$3,$4,$5,$6,$7,case when $6='finalized' then now() end) returning *`,
          [request.params.internId, mentor.rows[0]?.id ?? null, input.score, input.finalScore, input.feedback,
            input.submitType === "finalize" ? "finalized" : "draft", input.submitType === "finalize" ? identity.id : null],
        );
      }
      if (input.submitType === "finalize") {
        await client.query(
          `insert into utero_academy.certificates
            (assessment_id,intern_id,certificate_number,status,issued_at,signed_at,certificate_type)
           values ($1,$2,$3,'issued',now(),now(),'assessment') on conflict (assessment_id) do nothing`,
          [assessment.rows[0].id, request.params.internId, certificateNumber()],
        );
      }
      return { assessment: assessment.rows[0] };
    });
    if (result.error === "setup_required") return apiError(reply, 403, "mentor_profile_required");
    if (result.error === "forbidden") return apiError(reply, 404, "intern_not_found");
    if (result.error) return apiError(reply, 409, result.error);
    return result;
  });

  app.put("/v1/assessments/settings/certificate-template", async (request, reply) => {
    const identity = requirePermission(request, reply, ["certificates.generate"]);
    if (!identity) return;
    const objectPath = typeof request.body?.path === "string" ? request.body.path : "";
    if (!objectPath.startsWith("settings/") || objectPath.length > 500) return apiError(reply, 400, "invalid_object_path");
    const exists = await db.query("select 1 from academy_storage.objects where bucket_id='academy-private' and name=$1 and owner_id=$2 and deleted_at is null and mime_type like 'image/%'", [objectPath, identity.id]);
    if (!exists.rows[0]) return apiError(reply, 404, "object_not_found");
    await db.transaction(identity, (client) => client.query(
      `insert into utero_academy.attendance_settings (id,certificate_template_path,updated_at)
       values ('00000000-0000-0000-0000-000000000001',$1,now())
       on conflict (id) do update set certificate_template_path=excluded.certificate_template_path,updated_at=now()`, [objectPath],
    ));
    return { path: objectPath };
  });
}
