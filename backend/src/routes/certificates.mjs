import { requireIdentity, requirePermission } from "../auth/identity.mjs";
import { requireScopedIntern } from "../attendance/access.mjs";
import { validId } from "../assessments/input.mjs";
import { createStorageToken } from "../storage/signing.mjs";

function apiError(reply, status, error) { return reply.code(status).send({ error }); }

async function requireCertificateScope(client, identity, internId) {
  const own = await client.query("select 1 from utero_academy.intern_profiles where id=$1 and user_id=$2", [internId, identity.id]);
  if (own.rows[0]) return null;
  if (identity.roles.includes("school")) {
    const scoped = await client.query(
      `select 1 from utero_academy.intern_profiles ip
       join utero_academy.school_contacts sc on sc.school_id=ip.school_id
       where ip.id=$1 and sc.user_id=$2`,
      [internId, identity.id],
    );
    return scoped.rows[0] ? null : "forbidden";
  }
  return requireScopedIntern(client, identity, internId);
}

export async function certificatesRoutes(app, { db, config }) {
  app.get("/v1/certificates/:internId/context", async (request, reply) => {
    if (!validId(request.params.internId)) return apiError(reply, 400, "invalid_intern_id");
    const identity = requirePermission(request, reply, ["certificates.read"]);
    if (!identity) return;
    const context = await db.transaction(identity, async (client) => {
      const scopeError = await requireCertificateScope(client, identity, request.params.internId);
      if (scopeError) return { error: scopeError };
      const [profile, settings] = await Promise.all([
        client.query("select full_name,email,major,status,school_id from utero_academy.intern_profiles where id=$1", [request.params.internId]),
        client.query("select certificate_template_path from utero_academy.attendance_settings limit 1"),
      ]);
      return { internProfile: profile.rows[0] ?? null, settings: settings.rows[0] ?? null };
    });
    if (context.error === "setup_required") return apiError(reply, 403, "mentor_profile_required");
    if (context.error === "forbidden" || !context.internProfile) return apiError(reply, 404, "intern_not_found");
    const objectPath = context.settings?.certificate_template_path;
    if (objectPath && config?.storageSigningSecret) {
      const file = await db.query("select 1 from academy_storage.objects where bucket_id='academy-private' and name=$1 and deleted_at is null", [objectPath]);
      if (file.rows[0]) {
        const expiresAt = Date.now() + 21_600_000;
        const token = createStorageToken(config.storageSigningSecret, "academy-private", objectPath, expiresAt);
        context.templateUrl = `/api/storage/academy-private/${objectPath.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
      }
    }
    return context;
  });

  app.get("/v1/certificates/:internId", async (request, reply) => {
    if (!validId(request.params.internId)) return apiError(reply, 400, "invalid_intern_id");
    const identity = requirePermission(request, reply, ["certificates.read"]);
    if (!identity) return;
    const result = await db.transaction(identity, async (client) => {
      const scopeError = await requireCertificateScope(client, identity, request.params.internId);
      if (scopeError) return { error: scopeError };
      const row = await client.query(
        `select c.id,c.intern_id,c.certificate_number,c.file_path,c.status,c.issued_at,c.signed_at,
          json_build_object('id',a.id,'final_score',a.final_score,'feedback',a.feedback,'score',a.score) assessment,
          json_build_object('full_name',ip.full_name,'email',ip.email,'major',ip.major,'status',ip.status,'school_id',ip.school_id) intern_profile
         from utero_academy.certificates c join utero_academy.assessments a on a.id=c.assessment_id
         join utero_academy.intern_profiles ip on ip.id=c.intern_id
         where c.intern_id=$1 and c.assessment_id is not null`, [request.params.internId],
      );
      return row.rows[0] ?? null;
    });
    if (result?.error === "setup_required") return apiError(reply, 403, "mentor_profile_required");
    if (result?.error === "forbidden") return apiError(reply, 404, "certificate_not_found");
    if (!result) return apiError(reply, 404, "certificate_not_found");
    return { certificate: result };
  });
}
