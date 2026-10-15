import { requireIdentity } from "../auth/identity.mjs";
import { parseRegistration, validId } from "../registration/input.mjs";
import { calculateSelectionScore } from "../selection/score.mjs";

function applicant(request, reply) {
  const identity = requireIdentity(request, reply);
  if (!identity) return null;
  if (!identity.roles.some((role) => role === "applicant" || role === "super_admin")) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return identity;
}

export async function registrationRoutes(app, { db }) {
  app.get("/v1/registration/dashboard", async (request, reply) => {
    const identity = applicant(request, reply);
    if (!identity) return;
    return db.transaction(identity, async (client) => {
      const [profile, programs, applications, notifications] = await Promise.all([
        client.query("select full_name from utero_academy.user_profiles where id = $1", [identity.id]),
        client.query("select id, name from utero_academy.programs where status = 'published' order by name"),
        client.query(`select id, full_name, status, selection_status, onboarding_status, school_name, major,
          proposed_start_date, proposed_end_date, approved_start_date, approved_end_date, created_at
          from utero_academy.internship_applications where applicant_user_id = $1 order by created_at desc`, [identity.id]),
        client.query(`select id, subject, payload, status, created_at from utero_academy.application_notifications
          where recipient_user_id = $1 order by created_at desc limit 10`, [identity.id]),
      ]);
      return { profile: profile.rows[0] ?? null, programs: programs.rows, applications: applications.rows, notifications: notifications.rows };
    });
  });

  app.post("/v1/registration/applications", async (request, reply) => {
    const identity = applicant(request, reply);
    if (!identity) return;
    if (identity.roles.includes("intern")) return reply.code(403).send({ error: "already_intern" });
    if (!identity.email) return reply.code(400).send({ error: "email_required" });
    const input = parseRegistration(request.body);
    if (!input) return reply.code(400).send({ error: "invalid_registration" });
    if (![input.cvPath, input.portfolioPath].filter(Boolean).every((path) => path.startsWith(`${identity.id}/`))) return reply.code(403).send({ error: "forbidden" });
    const result = await db.transaction(identity, async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [identity.id]);
      const existing = await client.query(`select 1 from utero_academy.internship_applications
        where applicant_user_id = $1 and status not in ('rejected','cancelled','converted') limit 1`, [identity.id]);
      if (existing.rowCount) return { error: "active_application" };
      const program = await client.query("select 1 from utero_academy.programs where id = $1 and status = 'published'", [input.programId]);
      if (!program.rowCount) return { error: "program_unavailable" };
      let schoolId = null;
      let schoolName = input.schoolName;
      if (input.referralCode) {
        const school = await client.query("select * from utero_academy.lookup_referral_school($1)", [input.referralCode]);
        const row = school.rows[0];
        if (!row || !["verified", "active_partner"].includes(row.partner_status) || (row.referral_expires_at && new Date(row.referral_expires_at) < new Date())) return { error: "invalid_referral" };
        if (row.referral_quota) {
          const count = await client.query("select count(*)::int as total from utero_academy.internship_applications where school_id = $1 and source = 'self'", [row.id]);
          if (count.rows[0].total >= row.referral_quota) return { error: "referral_full" };
        }
        schoolId = row.id;
        schoolName = row.name;
      }
      const paths = [input.cvPath, input.portfolioPath].filter(Boolean);
      const files = await client.query(`select name from academy_storage.objects where bucket_id = 'academy-private'
        and owner_id = $1 and name = any($2::text[]) and deleted_at is null`, [identity.id, paths]);
      if (files.rowCount !== paths.length) return { error: "documents_missing" };
      const inserted = await client.query(`insert into utero_academy.internship_applications
        (program_id, school_id, source, applicant_user_id, submitted_by_user_id, full_name, email, phone,
         school_name, student_number, major, motivation, proposed_start_date, proposed_end_date,
         cv_path, portfolio_path, status, submitted_at)
        values ($1,$2,'self',$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'submitted',now()) returning id`,
        [input.programId, schoolId, identity.id, input.fullName, identity.email.toLowerCase(), input.phone,
          schoolName, input.studentNumber || null, input.major, input.motivation, input.proposedStartDate,
          input.proposedEndDate, input.cvPath, input.portfolioPath]);
      return { id: inserted.rows[0].id };
    });
    return result.error ? reply.code(409).send(result) : reply.code(201).send(result);
  });

  app.get("/v1/registration/selection", async (request, reply) => {
    const identity = applicant(request, reply);
    if (!identity) return;
    return db.transaction(identity, async (client) => {
      const applications = (await client.query("select id, full_name, selection_status, selection_track_id from utero_academy.internship_applications where applicant_user_id = $1", [identity.id])).rows;
      const ids = applications.map((row) => row.id);
      const assignments = (await client.query("select id, application_id, package_id, status, due_at, max_attempts from utero_academy.selection_assignments where application_id = any($1::uuid[])", [ids])).rows;
      const packages = (await client.query("select id, title, description, track_id, duration_minutes, available_from, available_until, is_published from utero_academy.selection_test_packages where id = any($1::uuid[])", [assignments.map((row) => row.package_id)])).rows;
      const attempts = (await client.query("select id, assignment_id, status, expires_at, attempt_number from utero_academy.selection_attempts where assignment_id = any($1::uuid[]) and applicant_user_id = $2 order by attempt_number desc", [assignments.map((row) => row.id), identity.id])).rows;
      const materials = (await client.query("select id, track_id, title, content, order_index from utero_academy.selection_materials where track_id = any($1::uuid[]) and is_published order by order_index", [applications.map((row) => row.selection_track_id).filter(Boolean)])).rows;
      const decisions = (await client.query(`select d.id as decision_id, d.application_id, d.result, d.final_score, d.public_note
        from utero_academy.selection_decisions d where d.application_id = any($1::uuid[]) order by d.decided_at desc`, [ids])).rows;
      return { applications, assignments, packages, attempts, materials,
        results: ids.map((applicationId) => ({ applicationId, rows: decisions.filter((row) => row.application_id === applicationId) })), currentTime: Date.now() };
    });
  });

  app.get("/v1/registration/selection/:assignmentId", async (request, reply) => {
    const identity = applicant(request, reply);
    if (!identity) return;
    if (!validId(request.params.assignmentId)) return reply.code(400).send({ error: "invalid_assignment" });
    const result = await db.transaction(identity, async (client) => {
      const assignment = (await client.query(`select s.id, s.application_id, s.package_id, s.status, s.due_at, s.max_attempts
        from utero_academy.selection_assignments s join utero_academy.internship_applications a on a.id = s.application_id
        where s.id = $1 and a.applicant_user_id = $2`, [request.params.assignmentId, identity.id])).rows[0];
      if (!assignment) return null;
      const test = (await client.query("select id, title, description, duration_minutes, is_published, available_from, available_until from utero_academy.selection_test_packages where id = $1", [assignment.package_id])).rows[0];
      if (!test?.is_published) return null;
      const attempt = (await client.query("select id, status, expires_at, attempt_number from utero_academy.selection_attempts where assignment_id = $1 and applicant_user_id = $2 order by attempt_number desc limit 1", [assignment.id, identity.id])).rows[0] ?? null;
      const active = attempt?.status === "in_progress" && attempt.expires_at && Date.now() < Date.parse(attempt.expires_at) && (!assignment.due_at || Date.now() < Date.parse(assignment.due_at));
      if (!active) return { assignment, test, attempt, questions: [], options: [], answers: [], active: false };
      const questions = (await client.query("select id, question_type, prompt, points, order_index, is_required from utero_academy.selection_questions where package_id = $1 order by order_index", [test.id])).rows;
      const options = (await client.query("select id, question_id, label, content, order_index from utero_academy.selection_question_options where question_id = any($1::uuid[]) order by order_index", [questions.map((row) => row.id)])).rows;
      const answers = (await client.query("select question_id, selected_option_ids, answer_text, attachment_path from utero_academy.selection_answers where attempt_id = $1", [attempt.id])).rows;
      return { assignment, test, attempt, questions, options, answers, active: true };
    });
    return result ?? reply.code(404).send({ error: "assignment_not_found" });
  });

  app.post("/v1/registration/selection/:assignmentId/start", async (request, reply) => {
    const identity = applicant(request, reply);
    if (!identity) return;
    if (!validId(request.params.assignmentId)) return reply.code(400).send({ error: "invalid_assignment" });
    const result = await db.transaction(identity, async (client) => {
      const assignment = (await client.query(`select s.id, s.max_attempts, s.due_at, s.available_from, s.package_id,
        p.duration_minutes, p.available_from as test_from, p.available_until as test_until, p.is_published
        from utero_academy.selection_assignments s
        join utero_academy.internship_applications a on a.id = s.application_id
        join utero_academy.selection_test_packages p on p.id = s.package_id
        where s.id = $1 and a.applicant_user_id = $2 for update of s`, [request.params.assignmentId, identity.id])).rows[0];
      if (!assignment) return { status: 404, error: "assignment_not_found" };
      const now = Date.now();
      if (!assignment.is_published || [assignment.due_at, assignment.test_until].some((value) => value && now >= Date.parse(value)) ||
          [assignment.available_from, assignment.test_from].some((value) => value && now < Date.parse(value))) return { status: 409, error: "test_unavailable" };
      const attempt = (await client.query("select status, expires_at, attempt_number from utero_academy.selection_attempts where assignment_id = $1 and applicant_user_id = $2 order by attempt_number desc limit 1", [assignment.id, identity.id])).rows[0];
      if (attempt?.status === "in_progress" && attempt.expires_at && now < Date.parse(attempt.expires_at)) return { ok: true };
      if (attempt && !["graded", "expired", "cancelled"].includes(attempt.status)) return { status: 409, error: "previous_attempt_open" };
      if ((attempt?.attempt_number ?? 0) >= assignment.max_attempts) return { status: 409, error: "attempt_limit" };
      await client.query(`insert into utero_academy.selection_attempts (assignment_id, applicant_user_id, attempt_number, status, started_at, expires_at)
        values ($1,$2,$3,'in_progress',now(),now() + $4 * interval '1 minute')`, [assignment.id, identity.id, (attempt?.attempt_number ?? 0) + 1, assignment.duration_minutes]);
      await client.query("update utero_academy.selection_assignments set status = 'in_progress', updated_at = now() where id = $1", [assignment.id]);
      return { ok: true };
    });
    return result.error ? reply.code(result.status).send({ error: result.error }) : result;
  });

  app.put("/v1/registration/selection/:assignmentId/answers/:questionId", async (request, reply) => {
    const identity = applicant(request, reply);
    if (!identity) return;
    const { assignmentId, questionId } = request.params;
    if (!validId(assignmentId) || !validId(questionId)) return reply.code(400).send({ error: "invalid_id" });
    const { optionId, answerText, attachmentPath } = request.body ?? {};
    if ((optionId !== null && optionId !== undefined && !validId(optionId)) || typeof answerText !== "string" || answerText.length > 10000 ||
        (attachmentPath !== null && attachmentPath !== undefined && (typeof attachmentPath !== "string" || !attachmentPath.startsWith(`${identity.id}/selection/`)))) return reply.code(400).send({ error: "invalid_answer" });
    const result = await db.transaction(identity, async (client) => {
      const attempt = (await client.query(`select t.id, t.expires_at, s.due_at, p.available_from, p.available_until
        from utero_academy.selection_attempts t join utero_academy.selection_assignments s on s.id = t.assignment_id
        join utero_academy.internship_applications a on a.id = s.application_id
        join utero_academy.selection_test_packages p on p.id = s.package_id
        where s.id = $1 and a.applicant_user_id = $2 and t.applicant_user_id = $2 and t.status = 'in_progress'
        order by t.attempt_number desc limit 1 for update of t`, [assignmentId, identity.id])).rows[0];
      const now = Date.now();
      if (!attempt || !attempt.expires_at || now >= Date.parse(attempt.expires_at) ||
        [attempt.due_at, attempt.available_until].some((value) => value && now >= Date.parse(value)) ||
        (attempt.available_from && now < Date.parse(attempt.available_from))) return { status: 409, error: "attempt_unavailable" };
      const question = (await client.query(`select q.question_type from utero_academy.selection_questions q
        join utero_academy.selection_assignments s on s.package_id = q.package_id where s.id = $1 and q.id = $2`, [assignmentId, questionId])).rows[0];
      if (!question) return { status: 404, error: "question_not_found" };
      const objective = ["multiple_choice", "true_false"].includes(question.question_type);
      if (objective && !validId(optionId)) return { status: 400, error: "option_required" };
      if (!objective && optionId) return { status: 400, error: "invalid_option" };
      if (objective) {
        const option = await client.query("select 1 from utero_academy.selection_question_options where id = $1 and question_id = $2", [optionId, questionId]);
        if (!option.rowCount) return { status: 400, error: "invalid_option" };
      }
      if (attachmentPath) {
        if (question.question_type !== "file_upload" || !attachmentPath.startsWith(`${identity.id}/selection/${attempt.id}/${questionId}/`)) return { status: 400, error: "invalid_attachment" };
        const file = await client.query("select 1 from academy_storage.objects where bucket_id = 'selection-answers' and owner_id = $1 and name = $2 and deleted_at is null", [identity.id, attachmentPath]);
        if (!file.rowCount) return { status: 400, error: "attachment_missing" };
      }
      if (question.question_type !== "file_upload" && attachmentPath) return { status: 400, error: "invalid_attachment" };
      const previous = attachmentPath ? (await client.query("select attachment_path from utero_academy.selection_answers where attempt_id = $1 and question_id = $2", [attempt.id, questionId])).rows[0]?.attachment_path ?? null : null;
      await client.query(`insert into utero_academy.selection_answers (attempt_id, question_id, selected_option_ids, answer_text, attachment_path, answered_at)
        values ($1,$2,$3::uuid[],$4,$5,now()) on conflict (attempt_id, question_id) do update set
        selected_option_ids = excluded.selected_option_ids, answer_text = excluded.answer_text,
        attachment_path = coalesce(excluded.attachment_path, utero_academy.selection_answers.attachment_path), answered_at = now()`,
      [attempt.id, questionId, optionId ? [optionId] : [], question.question_type === "file_upload" ? null : answerText.trim() || null, attachmentPath ?? null]);
      return { ok: true, previousAttachmentPath: previous };
    });
    return result.error ? reply.code(result.status).send({ error: result.error }) : result;
  });

  app.post("/v1/registration/selection/:assignmentId/submit", async (request, reply) => {
    const identity = applicant(request, reply);
    if (!identity) return;
    if (!validId(request.params.assignmentId)) return reply.code(400).send({ error: "invalid_assignment" });
    const result = await db.transaction(identity, async (client) => {
      const attempt = (await client.query(`select t.id, t.expires_at, s.due_at, p.available_from, p.available_until
        from utero_academy.selection_attempts t join utero_academy.selection_assignments s on s.id = t.assignment_id
        join utero_academy.internship_applications a on a.id = s.application_id
        join utero_academy.selection_test_packages p on p.id = s.package_id
        where s.id = $1 and a.applicant_user_id = $2 and t.applicant_user_id = $2 and t.status = 'in_progress'
        order by t.attempt_number desc limit 1 for update of t`, [request.params.assignmentId, identity.id])).rows[0];
      if (!attempt) return { status: 409, error: "attempt_unavailable" };
      const now = Date.now();
      if (!attempt.expires_at || now >= Date.parse(attempt.expires_at) || (attempt.due_at && now >= Date.parse(attempt.due_at))) {
        await client.query("update utero_academy.selection_attempts set status = 'expired', updated_at = now() where id = $1", [attempt.id]);
        return { expired: true };
      }
      if ((attempt.available_from && now < Date.parse(attempt.available_from)) || (attempt.available_until && now >= Date.parse(attempt.available_until))) return { status: 409, error: "test_unavailable" };
      const questions = (await client.query(`select q.id, q.question_type, q.points, q.is_required from utero_academy.selection_questions q
        join utero_academy.selection_assignments s on s.package_id = q.package_id where s.id = $1`, [request.params.assignmentId])).rows;
      const answers = (await client.query("select id, question_id, selected_option_ids, answer_text, attachment_path from utero_academy.selection_answers where attempt_id = $1", [attempt.id])).rows;
      if (questions.some((question) => question.is_required && !answers.some((answer) => answer.question_id === question.id && (answer.selected_option_ids.length || answer.answer_text || answer.attachment_path)))) return { status: 409, error: "required_answers_missing" };
      const manualRequired = questions.some((question) => !["multiple_choice", "true_false"].includes(question.question_type));
      const scoredAnswers = [];
      for (const question of questions) {
        const maxPoints = Number(question.points);
        if (!["multiple_choice", "true_false"].includes(question.question_type)) {
          scoredAnswers.push({ maxPoints, awardedPoints: null });
          continue;
        }
        const answer = answers.find((row) => row.question_id === question.id);
        let awardedPoints = 0;
        if (answer) {
          const option = await client.query("select is_correct from utero_academy.selection_question_options where id = $1 and question_id = $2", [answer.selected_option_ids[0], question.id]);
          awardedPoints = option.rows[0]?.is_correct ? maxPoints : 0;
          await client.query("update utero_academy.selection_answers set auto_score = $2, is_final = true, updated_at = now() where id = $1", [answer.id, awardedPoints]);
        }
        scoredAnswers.push({ maxPoints, awardedPoints });
      }
      const finalScore = calculateSelectionScore(scoredAnswers);
      await client.query(`update utero_academy.selection_attempts set status = $2, submitted_at = now(), final_score = $3, updated_at = now() where id = $1`,
        [attempt.id, manualRequired ? "grading" : "graded", finalScore]);
      await client.query("update utero_academy.selection_assignments set status = 'grading', updated_at = now() where id = $1", [request.params.assignmentId]);
      return { ok: true };
    });
    return result.error ? reply.code(result.status).send({ error: result.error }) : result;
  });
}
