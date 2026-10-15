import { requireIdentity, requirePermission, requireRolePermission } from "../auth/identity.mjs";
import { activeInternProfile, requireScopedIntern, staffScope } from "../attendance/access.mjs";
import { distanceMeters, resolveGeofence } from "../attendance/geofence.mjs";
import { parseCoordinates, parseDataUrl, parseUpload, validDate, validId } from "../attendance/input.mjs";
import { permitDates } from "../attendance/permit-dates.mjs";
import { cleanupObjects, storeDomainObject } from "../attendance/storage.mjs";

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const jakartaDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function apiError(reply, status, error) {
  return reply.code(status).send({ error });
}

export async function attendanceRoutes(app, { db, config }) {
  const reviewer = (request, reply) => requireRolePermission(
    request,
    reply,
    ["admin", "super_admin"],
    ["attendance.review"],
  );

  app.get("/v1/attendance/mentor-dashboard", async (request, reply) => {
    const identity = reviewer(request, reply);
    if (!identity) return;
    return db.transaction(identity, async (client) => {
      const scope = await staffScope(client, identity);
      if (scope === undefined) return { setupRequired: true, settings: null, interns: [], attendances: [], pendingPermits: [] };
      const settings = await client.query("select * from utero_academy.attendance_settings where id = $1", [SETTINGS_ID]);
      const values = scope === null ? [] : [scope];
      const scopeWhere = scope === null ? "" : "and ip.id = any($1::uuid[])";
      const interns = await client.query(
        `select ip.id, ip.full_name, ip.user_id, ip.status, ip.start_date::text as start_date, ip.major, ip.phone, ip.email
         from utero_academy.intern_profiles ip where ip.status = 'active' ${scopeWhere}
         and exists (select 1 from utero_academy.user_roles ur join utero_academy.roles r on r.id = ur.role_id
                     where ur.user_id = ip.user_id and r.code = 'intern') order by ip.full_name`, values,
      );
      const internIds = interns.rows.map((row) => row.id);
      if (!internIds.length) return { setupRequired: false, settings: settings.rows[0] ?? null, interns: [], attendances: [], pendingPermits: [] };
      const [attendances, permits] = await Promise.all([
        client.query("select *, attendance_date::text as attendance_date from utero_academy.attendances where intern_id = any($1::uuid[]) order by attendance_date desc", [internIds]),
        client.query(
          `select p.*, p.start_date::text as start_date, p.end_date::text as end_date, json_build_object('full_name', ip.full_name) intern_profiles
           from utero_academy.permits p join utero_academy.intern_profiles ip on ip.id = p.intern_id
           where p.status = 'pending' and p.intern_id = any($1::uuid[]) order by p.created_at desc`, [internIds],
        ),
      ]);
      return { setupRequired: false, settings: settings.rows[0] ?? null, interns: interns.rows, attendances: attendances.rows, pendingPermits: permits.rows };
    });
  });

  app.get("/v1/attendance/export-data", async (request, reply) => {
    const identity = reviewer(request, reply);
    if (!identity) return;
    const { startDate, endDate, mode = "monthly" } = request.query ?? {};
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return apiError(reply, 400, "invalid_export_range");
    const result = await db.transaction(identity, async (client) => {
      const scope = await staffScope(client, identity);
      if (scope === undefined) return null;
      const values = scope === null ? [] : [scope];
      const scopeWhere = scope === null ? "" : "and id = any($1::uuid[])";
      const interns = await client.query(
        `select id, full_name, email, major, phone from utero_academy.intern_profiles
         where status = 'active' ${scopeWhere} order by full_name`, values,
      );
      const internIds = interns.rows.map((row) => row.id);
      const settings = await client.query(
        "select check_in_time, late_tolerance_minutes, monthly_target_hours from utero_academy.attendance_settings where id = $1",
        [SETTINGS_ID],
      );
      const attendances = internIds.length ? await client.query(
        `select intern_id, attendance_date::text as attendance_date, check_in_at, check_out_at, status, attendance_type
         from utero_academy.attendances where intern_id = any($1::uuid[]) and attendance_date between $2 and $3`,
        [internIds, startDate, endDate],
      ) : { rows: [] };
      await client.query("select utero_academy.append_audit_log($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
        ["attendance.export", "attendances", null, null, null,
          JSON.stringify({ mode, period_start: startDate, period_end: endDate, scope: scope === null ? "global" : "scoped", intern_count: interns.rows.length })]);
      return { settings: settings.rows[0] ?? null, interns: interns.rows, attendances: attendances.rows };
    });
    if (!result) return apiError(reply, 403, "setup_required");
    return result;
  });

  app.get("/v1/attendance", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const result = await db.transaction(identity, async (client) => {
      if (identity.roles.includes("intern")) {
        const internId = await activeInternProfile(client, identity);
        if (!internId) return { rows: [], internId: null };
        if (request.query?.internId && request.query.internId !== internId) return null;
        const rows = await client.query("select * from utero_academy.attendances where intern_id = $1 order by attendance_date desc", [internId]);
        return { rows: rows.rows, internId };
      }
      if (!identity.permissions.includes("attendance.review") && !identity.roles.includes("super_admin")) return undefined;
      const scope = await staffScope(client, identity);
      if (scope === undefined) return { rows: [], setupRequired: true };
      const requested = request.query?.internId;
      if (requested && (!validId(requested) || (scope !== null && !scope.includes(requested)))) return null;
      const values = requested ? [requested] : scope === null ? [] : [scope];
      const where = requested ? "where a.intern_id = $1" : scope === null ? "" : "where a.intern_id = any($1::uuid[])";
      const rows = await client.query(
        `select a.*, json_build_object('id', ip.id, 'full_name', ip.full_name) intern_profiles
         from utero_academy.attendances a join utero_academy.intern_profiles ip on ip.id = a.intern_id
         ${where} order by a.attendance_date desc`, values,
      );
      return { rows: rows.rows };
    });
    if (result === undefined) return apiError(reply, 403, "forbidden");
    if (result === null) return apiError(reply, 404, "intern_not_found");
    return { attendances: result.rows, internId: result.internId ?? null, setupRequired: Boolean(result.setupRequired) };
  });

  app.get("/v1/attendance/today", async (request, reply) => {
    const identity = requirePermission(request, reply, ["attendance.submit"]);
    if (!identity) return;
    const row = await db.transaction(identity, async (client) => {
      const internId = await activeInternProfile(client, identity);
      if (!internId) return { internId: null, attendance: null };
      const result = await client.query("select * from utero_academy.attendances where intern_id = $1 and attendance_date = $2", [internId, jakartaDate()]);
      return { internId, attendance: result.rows[0] ?? null };
    });
    return row;
  });

  app.post("/v1/attendance/check-in", { bodyLimit: 30 * 1024 * 1024 }, async (request, reply) => {
    const identity = requirePermission(request, reply, ["attendance.submit"]);
    if (!identity) return;
    const coordinates = parseCoordinates(request.body);
    const selfie = parseDataUrl(request.body?.selfieDataUrl);
    if (!coordinates || !selfie || !["image/jpeg", "image/png", "image/webp"].includes(selfie.mimeType)) return apiError(reply, 400, "invalid_check_in");
    const cleanups = [];
    try {
      const attendance = await db.transaction(identity, async (client) => {
        const internId = await activeInternProfile(client, identity);
        if (!internId) return null;
        const settingsResult = await client.query("select * from utero_academy.attendance_settings where id = $1", [SETTINGS_ID]);
        const geofence = resolveGeofence(settingsResult.rows[0]);
        if (geofence.kind === "misconfigured") return { error: "geofence_misconfigured" };
        let outOfRange = false;
        let proofPath = null;
        let reason = null;
        if (geofence.kind === "active" && distanceMeters(coordinates.latitude, coordinates.longitude, geofence.latitude, geofence.longitude) > geofence.radiusMeters) {
          outOfRange = true;
          reason = typeof request.body?.outOfRangeReason === "string" ? request.body.outOfRangeReason.trim() : "";
          const proof = parseUpload(request.body?.outOfRangeProof);
          if (reason.length < 5 || !proof) return { error: "out_of_range_proof_required" };
          proofPath = await storeDomainObject({ db, config, identity, bucketName: "academy-private", prefix: `${identity.id}/attendance-proof`, upload: proof, cleanups });
        }
        const selfiePath = await storeDomainObject({
          db, config, identity, bucketName: "academy-private", prefix: `${identity.id}/attendance`,
          upload: { ...selfie, fileName: `check-in-${jakartaDate()}` }, cleanups,
        });
        const inserted = await client.query(
          `insert into utero_academy.attendances
           (intern_id, attendance_date, check_in_at, check_in_latitude, check_in_longitude, check_in_wifi_ssid,
            check_in_selfie_path, status, is_out_of_range, out_of_range_reason, out_of_range_proof_path)
           values ($1,$2,now(),$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
          [internId, jakartaDate(), coordinates.latitude, coordinates.longitude, coordinates.wifiSsid, selfiePath,
            outOfRange ? "manual_review" : "pending", outOfRange, reason, proofPath],
        );
        return { attendance: inserted.rows[0] };
      });
      if (!attendance) { await cleanupObjects(cleanups); return apiError(reply, 409, "intern_profile_inactive"); }
      if (attendance.error) { await cleanupObjects(cleanups); return apiError(reply, 400, attendance.error); }
      return reply.code(201).send(attendance);
    } catch (error) {
      await cleanupObjects(cleanups);
      if (error.code === "23505") return apiError(reply, 409, "attendance_exists");
      throw error;
    }
  });

  app.post("/v1/attendance/check-out", { bodyLimit: 15 * 1024 * 1024 }, async (request, reply) => {
    const identity = requirePermission(request, reply, ["attendance.submit"]);
    if (!identity) return;
    const coordinates = parseCoordinates(request.body);
    const selfie = parseDataUrl(request.body?.selfieDataUrl);
    if (!coordinates || !selfie || !["image/jpeg", "image/png", "image/webp"].includes(selfie.mimeType)) return apiError(reply, 400, "invalid_check_out");
    const cleanups = [];
    try {
      const result = await db.transaction(identity, async (client) => {
        const internId = await activeInternProfile(client, identity);
        if (!internId) return { error: "intern_profile_inactive" };
        const settings = await client.query("select * from utero_academy.attendance_settings where id = $1", [SETTINGS_ID]);
        const geofence = resolveGeofence(settings.rows[0]);
        if (geofence.kind === "misconfigured") return { error: "geofence_misconfigured" };
        if (geofence.kind === "active" && distanceMeters(coordinates.latitude, coordinates.longitude, geofence.latitude, geofence.longitude) > geofence.radiusMeters) return { error: "outside_geofence" };
        const selfiePath = await storeDomainObject({ db, config, identity, bucketName: "academy-private", prefix: `${identity.id}/attendance`, upload: { ...selfie, fileName: `check-out-${jakartaDate()}` }, cleanups });
        const updated = await client.query(
          `update utero_academy.attendances set check_out_at = now(), check_out_latitude = $3,
           check_out_longitude = $4, check_out_wifi_ssid = $5, check_out_selfie_path = $6, updated_at = now()
           where intern_id = $1 and attendance_date = $2 and check_in_at is not null and check_out_at is null returning *`,
          [internId, jakartaDate(), coordinates.latitude, coordinates.longitude, coordinates.wifiSsid, selfiePath],
        );
        return updated.rows[0] ? { attendance: updated.rows[0] } : { error: "check_in_required" };
      });
      if (result.error) { await cleanupObjects(cleanups); return apiError(reply, result.error === "check_in_required" ? 409 : 400, result.error); }
      return result;
    } catch (error) { await cleanupObjects(cleanups); throw error; }
  });

  app.post("/v1/attendance/permits", { bodyLimit: 30 * 1024 * 1024 }, async (request, reply) => {
    const identity = requirePermission(request, reply, ["attendance.submit"]);
    if (!identity) return;
    const { permitType, startDate, endDate } = request.body ?? {};
    const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : "";
    if (!["permit", "sick"].includes(permitType) || !validDate(startDate) || !validDate(endDate) || startDate > endDate || reason.length < 5) return apiError(reply, 400, "invalid_permit");
    const upload = parseUpload(request.body?.certificate);
    if (permitType === "sick" && !upload) return apiError(reply, 400, "certificate_required");
    const cleanups = [];
    try {
      const permit = await db.transaction(identity, async (client) => {
        const internId = await activeInternProfile(client, identity);
        if (!internId) return null;
        const attachmentPath = upload ? await storeDomainObject({ db, config, identity, bucketName: "academy-private", prefix: `${identity.id}/sick-certificates`, upload, cleanups }) : null;
        const inserted = await client.query(
          `insert into utero_academy.permits (intern_id, permit_type, start_date, end_date, reason, attachment_path)
           values ($1,$2,$3,$4,$5,$6) returning *`, [internId, permitType, startDate, endDate, reason, attachmentPath],
        );
        return inserted.rows[0];
      });
      if (!permit) { await cleanupObjects(cleanups); return apiError(reply, 409, "intern_profile_inactive"); }
      return reply.code(201).send({ permit });
    } catch (error) { await cleanupObjects(cleanups); throw error; }
  });

  app.patch("/v1/attendance/:id/review", async (request, reply) => {
    const identity = reviewer(request, reply);
    if (!identity) return;
    if (!validId(request.params.id) || !["valid", "invalid", "manual_review"].includes(request.body?.status)) return apiError(reply, 400, "invalid_review");
    const result = await db.transaction(identity, async (client) => {
      const row = await client.query("select intern_id from utero_academy.attendances where id = $1", [request.params.id]);
      if (!row.rows[0]) return "not_found";
      const denied = await requireScopedIntern(client, identity, row.rows[0].intern_id);
      if (denied) return denied;
      await client.query(
        "update utero_academy.attendances set status = $2, review_note = $3, reviewed_by = $4, reviewed_at = now(), updated_at = now() where id = $1",
        [request.params.id, request.body.status, typeof request.body.note === "string" ? request.body.note.trim().slice(0, 2000) || null : null, identity.id],
      );
      return "ok";
    });
    if (result === "not_found") return apiError(reply, 404, "attendance_not_found");
    if (result === "setup_required") return apiError(reply, 409, result);
    if (result === "forbidden") return apiError(reply, 403, result);
    return { ok: true };
  });

  app.patch("/v1/attendance/permits/:id/review", async (request, reply) => {
    const identity = reviewer(request, reply);
    if (!identity) return;
    if (!validId(request.params.id) || !["approved", "rejected"].includes(request.body?.status)) return apiError(reply, 400, "invalid_permit_review");
    const result = await db.transaction(identity, async (client) => {
      const found = await client.query("select * from utero_academy.permits where id = $1 for update", [request.params.id]);
      const permit = found.rows[0];
      if (!permit) return "not_found";
      const denied = await requireScopedIntern(client, identity, permit.intern_id);
      if (denied) return denied;
      const dateString = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
      const endDate = request.body.endDate || dateString(permit.end_date);
      const dates = request.body.status === "approved" ? permitDates(dateString(permit.start_date), endDate) : [];
      if (request.body.status === "approved" && !dates) return "invalid_range";
      await client.query("update utero_academy.permits set status=$2,end_date=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now() where id=$1", [permit.id, request.body.status, endDate, identity.id]);
      for (const date of dates) {
        await client.query(
          `insert into utero_academy.attendances
           (intern_id,attendance_date,attendance_type,permit_reason,sick_certificate_path,status,reviewed_by,reviewed_at)
           values ($1,$2,$3,$4,$5,'valid',$6,now())
           on conflict (intern_id,attendance_date) do update set attendance_type=excluded.attendance_type,
             permit_reason=excluded.permit_reason,sick_certificate_path=excluded.sick_certificate_path,status='valid',
             reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,updated_at=now()`,
          [permit.intern_id, date, permit.permit_type, permit.reason, permit.attachment_path, identity.id],
        );
      }
      return "ok";
    });
    const statuses = { not_found: 404, setup_required: 409, forbidden: 403, invalid_range: 400 };
    if (result !== "ok") return apiError(reply, statuses[result], result);
    return { ok: true };
  });

  app.patch("/v1/attendance/settings", async (request, reply) => {
    const identity = reviewer(request, reply);
    if (!identity) return;
    const body = request.body ?? {};
    const latitude = body.officeLatitude === null ? null : Number(body.officeLatitude);
    const longitude = body.officeLongitude === null ? null : Number(body.officeLongitude);
    const radius = Number(body.radiusMeters);
    const validClock = (value) => typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value) && Number(value.split(":")[0]) < 24 && Number(value.split(":")[1]) < 60;
    if (!validClock(body.checkInTime) || !validClock(body.checkOutTime) ||
        !Number.isInteger(body.lateToleranceMinutes) || body.lateToleranceMinutes < 0 || body.lateToleranceMinutes > 1440 ||
        !Number.isInteger(body.monthlyTargetHours) || body.monthlyTargetHours < 0 || body.monthlyTargetHours > 744 ||
        !Number.isInteger(radius) || radius < 0 || radius > 100000 ||
        (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
        (body.allowGeofencing && (latitude === null || longitude === null))) return apiError(reply, 400, "invalid_settings");
    await db.transaction(identity, (client) => client.query(
      `insert into utero_academy.attendance_settings
       (id,check_in_time,check_out_time,late_tolerance_minutes,monthly_target_hours,allow_geofencing,office_latitude,office_longitude,radius_meters,updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) on conflict (id) do update set check_in_time=excluded.check_in_time,
       check_out_time=excluded.check_out_time,late_tolerance_minutes=excluded.late_tolerance_minutes,
       monthly_target_hours=excluded.monthly_target_hours,allow_geofencing=excluded.allow_geofencing,
       office_latitude=excluded.office_latitude,office_longitude=excluded.office_longitude,radius_meters=excluded.radius_meters,updated_at=now()`,
      [SETTINGS_ID, body.checkInTime, body.checkOutTime, body.lateToleranceMinutes, body.monthlyTargetHours,
        Boolean(body.allowGeofencing), latitude, longitude, radius],
    ));
    return { ok: true };
  });
}
