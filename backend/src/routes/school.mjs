import { createStorageToken } from "../storage/signing.mjs";
import { parseApplication, parseReportRange } from "../school/input.mjs";
import { requireSchoolIdentity, resolveSchool, validId } from "../school/access.mjs";
import { inviteAccount } from "../auth/invitation.mjs";

const APPLICATION_SELECT = `id, full_name, email, phone, student_number, major, motivation, status,
  selection_status, onboarding_status, proposed_start_date, proposed_end_date, created_at, updated_at,
  reviewed_at, applicant_user_id`;

function sendScopeError(reply, result) {
  if (!result.error) return false;
  reply.code(result.error === "school_partner_inactive" ? 403 : 404).send({ error: result.error });
  return true;
}

function localStoragePath(config, bucket, objectPath) {
  if (!objectPath || !config?.storageSigningSecret) return objectPath ?? null;
  const expiresAt = Date.now() + 3600_000;
  const token = createStorageToken(config.storageSigningSecret, bucket, objectPath, expiresAt);
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  return `/api/storage/${encodeURIComponent(bucket)}/${encoded}?token=${encodeURIComponent(token)}`;
}

async function readInterns(client, schoolId) {
  const result = await client.query(
    `select i.id, i.user_id, i.full_name, i.email, i.phone, i.major, i.grade_or_semester, i.status,
            i.start_date, i.end_date,
            row_to_json(c) certificate, row_to_json(a) assessment
       from utero_academy.intern_profiles i
       left join lateral (select id, certificate_number, status, file_path from utero_academy.certificates where intern_id=i.id order by created_at desc limit 1) c on true
       left join lateral (select id, final_score, feedback, score, status from utero_academy.assessments where intern_id=i.id order by created_at desc limit 1) a on true
      where i.school_id=$1 order by i.full_name`, [schoolId]);
  return result.rows;
}

async function readAttendances(client, schoolId, internId = null) {
  const result = await client.query(
    `select a.id, a.intern_id, i.full_name intern_name, a.attendance_date, a.check_in_at, a.check_out_at,
            a.status, a.review_note, a.attendance_type
       from utero_academy.attendances a join utero_academy.intern_profiles i on i.id=a.intern_id
      where i.school_id=$1 and ($2::uuid is null or i.id=$2) order by a.attendance_date desc`, [schoolId, internId]);
  return result.rows;
}

async function readDailyReports(client, schoolId, config, internId = null) {
  const reports = await client.query(
    `select d.id, d.intern_id, i.full_name intern_name, d.report_date, d.today_work, d.progress,
            d.blockers, d.tomorrow_plan, d.status
       from utero_academy.daily_reports d join utero_academy.intern_profiles i on i.id=d.intern_id
      where i.school_id=$1 and ($2::uuid is null or i.id=$2) order by d.report_date desc`, [schoolId, internId]);
  if (!reports.rowCount) return [];
  const attachments = await client.query(
    `select a.id, a.report_id, a.file_path, a.file_name, a.mime_type
       from utero_academy.daily_report_attachments a where a.report_id=any($1::uuid[])`, [reports.rows.map((row) => row.id)]);
  return reports.rows.map((row) => ({ ...row, daily_report_attachments: attachments.rows.filter((item) => item.report_id === row.id).map((item) => ({
    ...item, file_path: item.mime_type === "url" ? item.file_path : localStoragePath(config, "daily-report", item.file_path),
  })) }));
}

function stats(interns, attendances) {
  const valid = attendances.filter((row) => ["valid", "pending"].includes(row.status));
  const present = valid.filter((row) => row.attendance_type === "present");
  const scored = interns.filter((row) => typeof row.assessment?.final_score === "number");
  return {
    totalInterns: interns.length,
    activeInterns: interns.filter((row) => row.status === "active").length,
    alumniInterns: interns.filter((row) => ["completed", "inactive"].includes(row.status)).length,
    avgAttendanceRate: valid.length ? Math.round(present.length / valid.length * 100) : 0,
    avgFinalScore: scored.length ? Number((scored.reduce((sum, row) => sum + Number(row.assessment.final_score), 0) / scored.length).toFixed(2)) : null,
    needAttentionCount: interns.filter((intern) => { const own=attendances.filter((a)=>a.intern_id===intern.id); return own.length && own.filter((a)=>a.attendance_type==="present"&&["valid","pending"].includes(a.status)).length/own.length < .8; }).length,
  };
}

async function reportMetrics(client, school, range) {
  const interns = await readInterns(client, school.id);
  if (!interns.length) return null;
  const attendance = await client.query(`select a.intern_id,a.check_in_at,a.check_out_at,a.attendance_type,a.status from utero_academy.attendances a join utero_academy.intern_profiles i on i.id=a.intern_id where i.school_id=$1 and a.attendance_date between $2 and $3`, [school.id, range.from, range.to]);
  const students = interns.map((intern) => { const own=attendance.rows.filter((a)=>a.intern_id===intern.id); const present=own.filter((a)=>a.attendance_type==="present"&&["valid","pending"].includes(a.status)); const hours=present.reduce((sum,a)=>sum+(a.check_in_at&&a.check_out_at?Math.max(0,(new Date(a.check_out_at)-new Date(a.check_in_at))/3600000):0),0); return { id:intern.id,full_name:intern.full_name,email:intern.email,major:intern.major,status:intern.status,attendance_rate:own.length?Math.round(present.length/own.length*100):0,total_hours:Number(hours.toFixed(2)),late_count:own.filter((a)=>a.status==="manual_review").length,permit_count:own.filter((a)=>a.attendance_type==="permit").length,sick_count:own.filter((a)=>a.attendance_type==="sick").length,final_score:intern.assessment?.final_score??null }; });
  const scored=students.filter((s)=>s.final_score!==null);
  return { school_id:school.id,school_name:school.name,period_start:range.from,period_end:range.to,total_students:students.length,active_students:students.filter((s)=>s.status==="active").length,avg_attendance_rate:Math.round(students.reduce((n,s)=>n+s.attendance_rate,0)/students.length),avg_total_hours:Number((students.reduce((n,s)=>n+s.total_hours,0)/students.length).toFixed(2)),avg_final_score:scored.length?Number((scored.reduce((n,s)=>n+Number(s.final_score),0)/scored.length).toFixed(2)):null,students };
}

export async function schoolRoutes(app, { db, config }) {
  async function scoped(request, reply, callback, options) {
    const identity = requireSchoolIdentity(request, reply); if (!identity) return;
    return db.transaction(identity, async (client) => { const scope=await resolveSchool(client, identity, options); if (sendScopeError(reply, scope)) return; return callback(client, scope.school, identity); });
  }

  app.get("/v1/school/context", (request, reply) => scoped(request, reply, async (_client, school) => ({ school })));
  app.get("/v1/school/dashboard", (request, reply) => scoped(request, reply, async (client, school) => { const interns=await readInterns(client,school.id); const attendances=await readAttendances(client,school.id); return { school, interns, attendances, stats:stats(interns,attendances) }; }));
  app.get("/v1/school/students", (request, reply) => scoped(request, reply, async (client, school) => ({ students:await readInterns(client,school.id) })));
  app.get("/v1/school/students/:id", (request, reply) => scoped(request, reply, async (client, school) => { if(!validId(request.params.id)) return reply.code(400).send({error:"invalid_student_id"}); const interns=await readInterns(client,school.id); const intern=interns.find((row)=>row.id===request.params.id); if(!intern)return reply.code(404).send({error:"student_not_found"}); return { intern, attendances:await readAttendances(client,school.id,intern.id), reports:await readDailyReports(client,school.id,config,intern.id) }; }));
  app.get("/v1/school/reports", (request, reply) => scoped(request, reply, async (client, school) => ({ reports:(await client.query("select id,report_type,period_start,period_end,file_path,total_students,status,created_at from utero_academy.school_reports where school_id=$1 order by created_at desc",[school.id])).rows, dailyReports:await readDailyReports(client,school.id,config) })));
  app.get("/v1/school/report-metrics", (request, reply) => scoped(request, reply, async (client, school) => { const range=parseReportRange(request.query); if(!range)return reply.code(400).send({error:"invalid_report_range"}); const metrics=await reportMetrics(client,school,range); return metrics?{metrics}:reply.code(404).send({error:"report_empty"}); }));
  app.post("/v1/school/reports", (request, reply) => scoped(request, reply, async (client, school, identity) => { const range=parseReportRange(request.body); if(!range)return reply.code(400).send({error:"invalid_report_range"}); const metrics=await reportMetrics(client,school,range); if(!metrics)return reply.code(404).send({error:"report_empty"}); await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`${school.id}:${range.from}:${range.to}`]); const existing=await client.query("select id from utero_academy.school_reports where school_id=$1 and period_start=$2 and period_end=$3 limit 1",[school.id,range.from,range.to]); const values=[school.id,range.from,range.to,identity.id,`/dashboard/school/reports/generate/download?from=${range.from}&to=${range.to}`,metrics.total_students]; if(existing.rowCount) await client.query("update utero_academy.school_reports set report_type='monthly',generated_by=$4,file_path=$5,total_students=$6,status='published' where id=$7",[...values,existing.rows[0].id]); else await client.query("insert into utero_academy.school_reports(school_id,report_type,period_start,period_end,generated_by,file_path,total_students,status) values($1,'monthly',$2,$3,$4,$5,$6,'published')",values); return reply.code(201).send({metrics}); }));
  app.get("/v1/school/applications", (request, reply) => scoped(request, reply, async (client, school) => { const args=[school.id]; let where="school_id=$1"; if(request.query?.status&&request.query.status!=="all"){args.push(request.query.status);where+=` and status=$${args.length}`;} if(request.query?.selectionStatus&&request.query.selectionStatus!=="all"){args.push(request.query.selectionStatus);where+=` and selection_status=$${args.length}`;} if(request.query?.query){args.push(`%${String(request.query.query).slice(0,100)}%`);where+=` and (full_name ilike $${args.length} or email ilike $${args.length} or student_number ilike $${args.length})`;} const rows=await client.query(`select ${APPLICATION_SELECT} from utero_academy.internship_applications where ${where} order by created_at desc`,args); return {school,applications:rows.rows}; },{active:true}));
  app.get("/v1/school/applications/:id", (request, reply) => scoped(request, reply, async (client, school) => { if(!validId(request.params.id))return reply.code(400).send({error:"invalid_application_id"}); const row=await client.query(`select ${APPLICATION_SELECT} from utero_academy.internship_applications where id=$1 and school_id=$2`,[request.params.id,school.id]); if(!row.rowCount)return reply.code(404).send({error:"application_not_found"}); const results=await client.query("select decision_id,result,final_score,public_note,decided_at from utero_academy.visible_selection_results($1)",[request.params.id]); return {school,application:row.rows[0],selectionResults:results.rows}; },{active:true}));
  app.post("/v1/school/applications", (request, reply) => scoped(request, reply, async (client, school, identity) => { const input=parseApplication(request.body); if(!input)return reply.code(400).send({error:"invalid_application"}); await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`${school.id}:${input.email}:${input.studentNumber}`]); const duplicate=await client.query("select 1 from utero_academy.internship_applications where school_id=$1 and (lower(email)=lower($2) or student_number=$3) and status not in ('rejected','cancelled','converted') limit 1",[school.id,input.email,input.studentNumber]); if(duplicate.rowCount)return reply.code(409).send({error:"duplicate_application"}); const inserted=await client.query(`insert into utero_academy.internship_applications(full_name,email,phone,student_number,school_name,school_id,major,motivation,proposed_start_date,proposed_end_date,source,submitted_by_user_id,status,selection_status,onboarding_status,submitted_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'school',$11,'submitted','not_assigned','not_started',now()) returning id`,[input.fullName,input.email,input.phone,input.studentNumber,school.name,school.id,input.major,input.motivation,input.proposedStartDate,input.proposedEndDate,identity.id]); return reply.code(201).send({id:inserted.rows[0].id,invitation:"pending_admin"}); },{active:true}));
  app.post("/v1/school/applications/:id/invite", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
    const identity = requireSchoolIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_application_id" });
    const application = await db.transaction(identity, async (client) => {
      const scope = await resolveSchool(client, identity, { active: true }); if (sendScopeError(reply, scope)) return null;
      return (await client.query("select id,email,full_name,school_id,source from utero_academy.internship_applications where id=$1 and school_id=$2", [request.params.id, scope.school.id])).rows[0] ?? null;
    });
    if (!application) return reply.sent ? undefined : reply.code(404).send({ error: "application_not_found" });
    const result = await inviteAccount(db, config, request.log, { email: application.email, fullName: application.full_name, role: "applicant", applicationId: application.id });
    return reply.code(result.status).send(result);
  });
}
