import { requireIdentity, requirePermission } from "../auth/identity.mjs";
import { certificateNumber } from "../certificates/number.mjs";
import { validId } from "../tasks/access.mjs";
import { scoreQuiz } from "../lms/score.mjs";

export async function lmsRoutes(app, { db }) {
  const staff = (request, reply) => {
    const identity=requirePermission(request,reply,["lms.manage"]);
    if(!identity)return null;
    if(!identity.roles.some((role)=>role==="admin"||role==="super_admin")){reply.code(403).send({error:"forbidden"});return null;}
    return identity;
  };
  const title = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 300 ? value.trim() : null;
  const participant = (request, reply) => {
    const identity = requirePermission(request, reply, ["lms.read"]);
    if (!identity) return null;
    if (!identity.roles.includes("intern")) { reply.code(403).send({ error: "forbidden" }); return null; }
    return identity;
  };
  const enrollment = async (client, identity, lessonId) => {
    const result = await client.query(`select l.id, l.course_id, ip.id as intern_id from utero_academy.lessons l
      join utero_academy.courses c on c.id=l.course_id and c.status='published'
      join utero_academy.intern_profiles ip on ip.user_id=$2 and ip.status='active'
      join utero_academy.course_enrollments e on e.intern_id=ip.id and e.course_id=l.course_id
      where l.id=$1 and l.is_published is not false`, [lessonId, identity.id]);
    return result.rows[0];
  };
  const quizEnrollment = async (client, identity, quizId) => {
    const result = await client.query(`select q.*, ip.id as intern_id from utero_academy.quizzes q
      join utero_academy.courses c on c.id=q.course_id and c.status='published'
      join utero_academy.intern_profiles ip on ip.user_id=$2 and ip.status='active'
      join utero_academy.course_enrollments e on e.intern_id=ip.id and e.course_id=q.course_id
      where q.id=$1 and q.is_published is not false`, [quizId, identity.id]);
    return result.rows[0];
  };
  const internProfile = async (client, identity) => (await client.query(
    "select id from utero_academy.intern_profiles where user_id=$1 and status='active'",
    [identity.id],
  )).rows[0];
  const assignmentEnrollment = async (client, identity, assignmentId) => {
    const result = await client.query(`select a.*,ip.id as intern_id from utero_academy.assignments a
      join utero_academy.courses c on c.id=a.course_id and c.status='published'
      join utero_academy.intern_profiles ip on ip.user_id=$2 and ip.status='active'
      join utero_academy.course_enrollments e on e.intern_id=ip.id and e.course_id=a.course_id
      where a.id=$1 and a.is_published is not false`, [assignmentId, identity.id]);
    return result.rows[0];
  };

  app.post("/v1/lms/courses",async(request,reply)=>{const identity=staff(request,reply);if(!identity)return;
    const name=title(request.body?.title); if(!name)return reply.code(400).send({error:"invalid_title"});
    const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
    if(!slug)return reply.code(400).send({error:"invalid_slug"});
    const result=await db.transaction(identity,(client)=>client.query("insert into utero_academy.courses(title,slug,description,status,created_by) values($1,$2,$3,'draft',$4) returning *",[name,slug,request.body?.description||null,identity.id]));
    return reply.code(201).send({course:result.rows[0]});
  });

  app.patch("/v1/lms/courses/:id/status",async(request,reply)=>{const identity=staff(request,reply);if(!identity)return;
    if(!validId(request.params.id)||!["draft","published","archived"].includes(request.body?.status))return reply.code(400).send({error:"invalid_status"});
    const result=await db.transaction(identity,(client)=>client.query("update utero_academy.courses set status=$2,updated_at=now() where id=$1 returning id",[request.params.id,request.body.status]));
    return result.rowCount?{courseId:request.params.id}:reply.code(404).send({error:"course_not_found"});
  });

  app.post("/v1/lms/courses/:id/lessons",async(request,reply)=>{const identity=staff(request,reply);if(!identity)return;
    const name=title(request.body?.title);if(!validId(request.params.id)||!name)return reply.code(400).send({error:"invalid_lesson"});
    return db.transaction(identity,async(client)=>{const course=await client.query("select 1 from utero_academy.courses where id=$1",[request.params.id]);if(!course.rowCount)return reply.code(404).send({error:"course_not_found"});
      const result=await client.query(`insert into utero_academy.lessons(course_id,title,content,video_url,order_index) select $1,$2,$3::text,$4,coalesce(max(order_index),-1)+1 from utero_academy.lessons where course_id=$1 returning *`,[request.params.id,name,String(request.body?.content??""),request.body?.videoUrl||null]);return reply.code(201).send({lesson:result.rows[0]});});
  });

  app.patch("/v1/lms/lessons/:id",async(request,reply)=>{const identity=staff(request,reply);if(!identity)return;
    if(!validId(request.params.id))return reply.code(400).send({error:"invalid_lesson_id"});
    const name=title(request.body?.title);if(request.body?.title!==undefined&&!name)return reply.code(400).send({error:"invalid_title"});
    const result=await db.transaction(identity,(client)=>client.query(`update utero_academy.lessons set title=coalesce($2,title),content=case when $3::boolean then $4::text else content end,video_url=case when $5::boolean then $6 else video_url end,is_published=coalesce($7,is_published),updated_at=now() where id=$1 returning id`,[request.params.id,name,Object.hasOwn(request.body??{},"content"),String(request.body?.content??""),Object.hasOwn(request.body??{},"videoUrl"),request.body?.videoUrl||null,request.body?.isPublished??null]));
    return result.rowCount?{lessonId:request.params.id}:reply.code(404).send({error:"lesson_not_found"});
  });

  app.delete("/v1/lms/lessons/:id",async(request,reply)=>{const identity=staff(request,reply);if(!identity)return;if(!validId(request.params.id))return reply.code(400).send({error:"invalid_lesson_id"});
    const result=await db.transaction(identity,(client)=>client.query("delete from utero_academy.lessons where id=$1 returning id",[request.params.id]));return result.rowCount?reply.code(204).send():reply.code(404).send({error:"lesson_not_found"});});

  app.post("/v1/lms/courses/:id/enroll",async(request,reply)=>{const identity=requireIdentity(request,reply);if(!identity)return;
    if(!identity.roles.includes("intern")||!identity.permissions.includes("lms.read"))return reply.code(403).send({error:"forbidden"});
    if(!validId(request.params.id))return reply.code(400).send({error:"invalid_course_id"});
    return db.transaction(identity,async(client)=>{const profile=await client.query("select id from utero_academy.intern_profiles where user_id=$1 and status='active'",[identity.id]);if(!profile.rowCount)return reply.code(403).send({error:"intern_inactive"});
      const course=await client.query("select id from utero_academy.courses where id=$1 and status='published'",[request.params.id]);if(!course.rowCount)return reply.code(404).send({error:"course_not_found"});
      await client.query("insert into utero_academy.course_enrollments(course_id,intern_id) values($1,$2) on conflict (course_id,intern_id) do nothing",[request.params.id,profile.rows[0].id]);return reply.code(201).send({courseId:request.params.id});});
  });
  app.get("/v1/lms/courses/published", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const result = await db.transaction(identity, (client) => client.query(
      "select id, title, description, slug, status from utero_academy.courses where status = 'published' order by title",
    ));
    return { courses: result.rows };
  });

  app.get("/v1/lms/courses", async (request, reply) => {
    const identity = requirePermission(request, reply, ["lms.manage"]);
    if (!identity || !identity.roles.some((role) => role === "admin" || role === "super_admin")) {
      return identity && reply.code(403).send({ error: "forbidden" });
    }
    const result = await db.transaction(identity, (client) => client.query(
      "select * from utero_academy.courses order by created_at desc",
    ));
    return { courses: result.rows };
  });
  app.get("/v1/lms/courses/:id/detail", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_course_id" });
    const manages = identity.roles.some((role) => role === "admin" || role === "super_admin") && identity.permissions.includes("lms.manage");
    if (!manages && (!identity.roles.includes("intern") || !identity.permissions.includes("lms.read"))) return reply.code(403).send({ error: "forbidden" });
    const result = await db.transaction(identity, async (client) => {
      let profileId = null;
      if (!manages) {
        const profile = await internProfile(client, identity); if (!profile) return null;
        const enrolled = await client.query("select 1 from utero_academy.course_enrollments where course_id=$1 and intern_id=$2", [request.params.id, profile.id]);
        if (!enrolled.rowCount) return null;
        profileId = profile.id;
      }
      const course = await client.query(`select id,title,description,slug,status from utero_academy.courses
        where id=$1 and ($2::boolean or status='published')`, [request.params.id, manages]);
      if (!course.rowCount) return null;
      const [lessons, quizzes, assignments, progress, attempts, submissions] = await Promise.all([
        client.query(`select id,course_id,title,content,video_url,order_index,is_published,attachments from utero_academy.lessons
          where course_id=$1 and ($2::boolean or is_published is not false) order by order_index`, [request.params.id, manages]),
        client.query(`select id,course_id,title,passing_score,is_published from utero_academy.quizzes
          where course_id=$1 and ($2::boolean or is_published is not false)`, [request.params.id, manages]),
        client.query(`select id,course_id,title,description,due_at,is_published from utero_academy.assignments
          where course_id=$1 and ($2::boolean or is_published is not false)`, [request.params.id, manages]),
        profileId ? client.query("select lesson_id,completed_at from utero_academy.lesson_progress where intern_id=$1", [profileId]) : Promise.resolve({ rows: [] }),
        profileId ? client.query("select quiz_id,score from utero_academy.quiz_attempts where intern_id=$1", [profileId]) : Promise.resolve({ rows: [] }),
        profileId ? client.query("select assignment_id,score,reviewed_at from utero_academy.assignment_submissions where intern_id=$1", [profileId]) : Promise.resolve({ rows: [] }),
      ]);
      return { course: course.rows[0], lessons: lessons.rows, quizzes: quizzes.rows, assignments: assignments.rows,
        progress: progress.rows, attempts: attempts.rows, submissions: submissions.rows };
    });
    return result ? result : reply.code(404).send({ error: "course_not_found" });
  });

  app.get("/v1/lms/enrollments", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    if (!identity.roles.includes("intern") && !identity.roles.includes("super_admin")) return reply.code(403).send({ error: "forbidden" });
    if (request.query?.internId && !validId(request.query.internId)) return reply.code(400).send({ error: "invalid_intern_id" });
    const result = await db.transaction(identity, async (client) => {
      const profile = await client.query("select id from utero_academy.intern_profiles where user_id = $1 and status = 'active'", [identity.id]);
      const profileId = profile.rows[0]?.id;
      if (!profileId || (request.query?.internId && request.query.internId !== profileId)) return null;
      return client.query(
        `select e.course_id, e.enrolled_at, e.completed_at,
                json_build_object('id', c.id, 'title', c.title, 'description', c.description, 'slug', c.slug) as courses
         from utero_academy.course_enrollments e
         join utero_academy.courses c on c.id = e.course_id and c.status = 'published'
         where e.intern_id = $1 order by e.enrolled_at desc`, [profileId],
      );
    });
    if (!result) {
      return reply.code(404).send({ error: "intern_not_found" });
    }
    return { enrollments: result.rows };
  });

  app.post("/v1/lms/lessons/:id/progress", async (request, reply) => {
    const identity = participant(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_lesson_id" });
    const result = await db.transaction(identity, async (client) => {
      const access = await enrollment(client, identity, request.params.id); if (!access) return null;
      await client.query(`insert into utero_academy.lesson_progress(lesson_id,intern_id,completed_at,progress_percent)
        values($1,$2,now(),100) on conflict(lesson_id,intern_id) do update set completed_at=now(),progress_percent=100,updated_at=now()`, [access.id, access.intern_id]);
      const remaining = await client.query(`select 1 from utero_academy.lessons l where l.course_id=$1 and l.is_published is not false
        and not exists(select 1 from utero_academy.lesson_progress p where p.lesson_id=l.id and p.intern_id=$2 and p.completed_at is not null) limit 1`, [access.course_id, access.intern_id]);
      if (!remaining.rowCount) {
        await client.query("update utero_academy.course_enrollments set completed_at=coalesce(completed_at,now()) where course_id=$1 and intern_id=$2", [access.course_id, access.intern_id]);
        await client.query(`insert into utero_academy.certificates
          (intern_id,course_id,certificate_type,certificate_number,final_score,status,issued_at,signed_at,notes)
          select $2,$1,'course_completion',$3,100,'issued',now(),now(),'Menyelesaikan course: ' || c.title
          from utero_academy.courses c where c.id=$1
          on conflict (intern_id,course_id) where course_id is not null do nothing`,
        [access.course_id, access.intern_id, certificateNumber()]);
      }
      return access.course_id;
    });
    return result ? { lessonId: request.params.id, courseId: result } : reply.code(404).send({ error: "lesson_not_found" });
  });
  app.get("/v1/lms/lessons/:id", async (request, reply) => {
    const identity = participant(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_lesson_id" });
    const result = await db.transaction(identity, async (client) => {
      const access = await enrollment(client, identity, request.params.id); if (!access) return null;
      const lesson = await client.query(`select l.*,exists(select 1 from utero_academy.lesson_progress p where p.lesson_id=l.id and p.intern_id=$2 and p.completed_at is not null) is_completed
        from utero_academy.lessons l where l.id=$1`, [request.params.id, access.intern_id]);
      return lesson.rows[0];
    });
    return result ? { lesson: result } : reply.code(404).send({ error: "lesson_not_found" });
  });

  app.get("/v1/lms/bookmarks", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    const result = await db.transaction(identity, (client) => client.query(`select b.*,json_build_object('title',l.title,'course_id',l.course_id) lesson
      from utero_academy.lesson_bookmarks b join utero_academy.lessons l on l.id=b.lesson_id where b.user_id=$1 order by b.created_at desc`, [identity.id]));
    return { bookmarks: result.rows };
  });
  app.post("/v1/lms/lessons/:id/bookmark", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_lesson_id" });
    const note = request.body?.note == null ? null : String(request.body.note).trim().slice(0, 2000);
    const result = await db.transaction(identity, async (client) => {
      const existing = await client.query("select id from utero_academy.lesson_bookmarks where user_id=$1 and lesson_id=$2", [identity.id, request.params.id]);
      if (existing.rowCount) { await client.query("delete from utero_academy.lesson_bookmarks where id=$1 and user_id=$2", [existing.rows[0].id, identity.id]); return false; }
      const lesson = identity.roles.includes("intern")
        ? await enrollment(client, identity, request.params.id)
        : (await client.query("select id from utero_academy.lessons where id=$1 and is_published is not false", [request.params.id])).rows[0];
      if (!lesson) return null;
      await client.query("insert into utero_academy.lesson_bookmarks(user_id,lesson_id,note) values($1,$2,$3)", [identity.id, request.params.id, note || null]); return true;
    });
    return result === null ? reply.code(404).send({ error: "lesson_not_found" }) : { bookmarked: result };
  });
  app.delete("/v1/lms/bookmarks/:id", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_bookmark_id" });
    const result = await db.transaction(identity, (client) => client.query("delete from utero_academy.lesson_bookmarks where id=$1 and user_id=$2 returning id", [request.params.id, identity.id]));
    return result.rowCount ? reply.code(204).send() : reply.code(404).send({ error: "bookmark_not_found" });
  });

  app.post("/v1/lms/lessons/:id/comments", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    const content = typeof request.body?.content === "string" ? request.body.content.trim() : "";
    const parentId = request.body?.parentCommentId ?? null;
    if (!validId(request.params.id) || !content || content.length > 5000 || (parentId && !validId(parentId))) return reply.code(400).send({ error: "invalid_comment" });
    const result = await db.transaction(identity, async (client) => {
      const lesson = identity.roles.includes("intern")
        ? await enrollment(client, identity, request.params.id)
        : (await client.query("select id from utero_academy.lessons where id=$1", [request.params.id])).rows[0];
      if (!lesson) return null;
      if (parentId) { const parent = await client.query("select 1 from utero_academy.lesson_comments where id=$1 and lesson_id=$2", [parentId, request.params.id]); if (!parent.rowCount) return false; }
      return client.query("insert into utero_academy.lesson_comments(lesson_id,user_id,parent_comment_id,content) values($1,$2,$3,$4) returning *", [request.params.id, identity.id, parentId, content]);
    });
    if (result === null) return reply.code(404).send({ error: "lesson_not_found" });
    if (result === false) return reply.code(400).send({ error: "invalid_parent_comment" });
    return reply.code(201).send({ comment: result.rows[0] });
  });
  app.get("/v1/lms/lessons/:id/comments", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_lesson_id" });
    const result = await db.transaction(identity, (client) => client.query(`select c.*,json_build_object('full_name',p.full_name,'avatar_url',p.avatar_url) user_profile
      from utero_academy.lesson_comments c left join utero_academy.user_profiles p on p.id=c.user_id
      where c.lesson_id=$1 order by c.is_pinned desc,c.created_at asc`, [request.params.id]));
    return { comments: result.rows };
  });
  app.patch("/v1/lms/comments/:id/pin", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    if (!validId(request.params.id) || typeof request.body?.isPinned !== "boolean") return reply.code(400).send({ error: "invalid_comment" });
    const result = await db.transaction(identity, (client) => client.query("update utero_academy.lesson_comments set is_pinned=$2,updated_at=now() where id=$1 returning lesson_id", [request.params.id, request.body.isPinned]));
    return result.rowCount ? { lessonId: result.rows[0].lesson_id } : reply.code(404).send({ error: "comment_not_found" });
  });
  app.delete("/v1/lms/comments/:id", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_comment_id" });
    const moderator = identity.roles.some((role) => role === "admin" || role === "super_admin");
    const result = await db.transaction(identity, (client) => client.query("delete from utero_academy.lesson_comments where id=$1 and (user_id=$2 or $3::boolean) returning lesson_id", [request.params.id, identity.id, moderator]));
    return result.rowCount ? reply.code(204).send() : reply.code(404).send({ error: "comment_not_found" });
  });

  app.get("/v1/lms/quizzes/:id/attempt-status", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_quiz_id" });
    const result = await db.transaction(identity, (client) => client.query("select * from utero_academy.can_attempt_quiz($1,$2)", [identity.id, request.params.id]));
    return { status: result.rows[0] ?? null };
  });
  app.get("/v1/lms/quizzes/:id", async (request, reply) => {
    const identity = participant(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_quiz_id" });
    const result = await db.transaction(identity, async (client) => {
      const quiz = await quizEnrollment(client, identity, request.params.id); if (!quiz) return null;
      const attempts = await client.query("select id,score,answers,submitted_at from utero_academy.quiz_attempts where quiz_id=$1 and intern_id=$2 order by submitted_at desc", [quiz.id, quiz.intern_id]);
      delete quiz.intern_id;
      return { ...quiz, attempts: attempts.rows };
    });
    return result ? { quiz: result } : reply.code(404).send({ error: "quiz_not_found" });
  });
  app.get("/v1/lms/quizzes/:id/attempt-summary", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_quiz_id" });
    const result = await db.transaction(identity, (client) => client.query("select * from utero_academy.user_quiz_attempts_summary where user_id=$1 and quiz_id=$2", [identity.id, request.params.id]));
    return { summary: result.rows[0] ?? null };
  });
  app.post("/v1/lms/quizzes/:id/attempts", async (request, reply) => {
    const identity = participant(request, reply); if (!identity) return;
    if (!validId(request.params.id) || !request.body?.answers || typeof request.body.answers !== "object") return reply.code(400).send({ error: "invalid_attempt" });
    const result = await db.transaction(identity, async (client) => {
      await client.query("select id from utero_academy.quizzes where id=$1 for update", [request.params.id]);
      const quiz = await quizEnrollment(client, identity, request.params.id); if (!quiz) return null;
      const gate = await client.query("select * from utero_academy.can_attempt_quiz($1,$2)", [identity.id, request.params.id]); if (gate.rows[0]?.can_attempt !== true) return { gate: gate.rows[0] };
      const scored = scoreQuiz(quiz.questions, request.body.answers);
      const inserted = await client.query("insert into utero_academy.quiz_attempts(quiz_id,intern_id,answers,score,finished_at) values($1,$2,$3::jsonb,$4,now()) returning id,score,submitted_at", [quiz.id, quiz.intern_id, JSON.stringify(scored.answers), scored.score]);
      return { attempt: inserted.rows[0], courseId: quiz.course_id };
    });
    if (!result) return reply.code(404).send({ error: "quiz_not_found" });
    if (result.gate) return reply.code(409).send({ error: "attempt_not_allowed", status: result.gate });
    return reply.code(201).send(result);
  });

  app.post("/v1/lms/courses/:id/assignments", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    const name = title(request.body?.title);
    const dueAt = request.body?.dueAt == null || request.body.dueAt === "" ? null : new Date(request.body.dueAt);
    if (!validId(request.params.id) || !name || (dueAt && Number.isNaN(dueAt.getTime()))) return reply.code(400).send({ error: "invalid_assignment" });
    const result = await db.transaction(identity, (client) => client.query(
      "insert into utero_academy.assignments(course_id,title,description,due_at) values($1,$2,$3,$4) returning *",
      [request.params.id, name, request.body?.description || null, dueAt],
    ));
    return reply.code(201).send({ assignment: result.rows[0] });
  });
  app.patch("/v1/lms/assignments/:id/publish", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    if (!validId(request.params.id) || typeof request.body?.isPublished !== "boolean") return reply.code(400).send({ error: "invalid_assignment" });
    const result = await db.transaction(identity, (client) => client.query(
      "update utero_academy.assignments set is_published=$2,updated_at=now() where id=$1 returning course_id",
      [request.params.id, request.body.isPublished],
    ));
    return result.rowCount ? { courseId: result.rows[0].course_id } : reply.code(404).send({ error: "assignment_not_found" });
  });
  app.get("/v1/lms/assignments/:id", async (request, reply) => {
    const identity = participant(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_assignment_id" });
    const result = await db.transaction(identity, async (client) => {
      const assignment = await assignmentEnrollment(client, identity, request.params.id); if (!assignment) return null;
      const submission = await client.query(`select id,content,attachment_path,score,feedback,submitted_at,reviewed_at
        from utero_academy.assignment_submissions where assignment_id=$1 and intern_id=$2`, [assignment.id, assignment.intern_id]);
      delete assignment.intern_id;
      return { ...assignment, submission: submission.rows[0] ?? null };
    });
    return result ? { assignment: result } : reply.code(404).send({ error: "assignment_not_found" });
  });
  app.post("/v1/lms/assignments/:id/submission", async (request, reply) => {
    const identity = participant(request, reply); if (!identity) return;
    const content = request.body?.content == null ? null : String(request.body.content).trim().slice(0, 20000) || null;
    const attachmentPath = request.body?.attachmentPath == null ? null : String(request.body.attachmentPath);
    if (!validId(request.params.id) || (attachmentPath && !attachmentPath.startsWith(`${identity.id}/`))) return reply.code(400).send({ error: "invalid_submission" });
    const result = await db.transaction(identity, async (client) => {
      const assignment = await assignmentEnrollment(client, identity, request.params.id); if (!assignment) return null;
      await client.query("select id from utero_academy.assignments where id=$1 for update", [assignment.id]);
      const existing = await client.query("select id from utero_academy.assignment_submissions where assignment_id=$1 and intern_id=$2", [assignment.id, assignment.intern_id]);
      const saved = existing.rowCount
        ? await client.query(`update utero_academy.assignment_submissions set content=$2,
            attachment_path=coalesce($3,attachment_path),submitted_at=now() where id=$1 returning id`, [existing.rows[0].id, content, attachmentPath])
        : await client.query(`insert into utero_academy.assignment_submissions(assignment_id,intern_id,content,attachment_path)
            values($1,$2,$3,$4) returning id`, [assignment.id, assignment.intern_id, content, attachmentPath]);
      await client.query("select utero_academy.update_daily_activity($1,'assignment_submitted',0,0)", [identity.id]);
      await client.query("select utero_academy.update_user_streak($1)", [identity.id]);
      await client.query("select utero_academy.check_and_award_badges($1,'assignment')", [identity.id]);
      return { submissionId: saved.rows[0].id, courseId: assignment.course_id };
    });
    return result ? reply.code(201).send(result) : reply.code(404).send({ error: "assignment_not_found" });
  });
  app.get("/v1/lms/submissions", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    const result = await db.transaction(identity, (client) => client.query(`select s.*,a.title assignment_title,ip.full_name intern_name
      from utero_academy.assignment_submissions s join utero_academy.assignments a on a.id=s.assignment_id
      join utero_academy.intern_profiles ip on ip.id=s.intern_id
      where $1::boolean or exists(select 1 from utero_academy.mentor_profiles mp join utero_academy.mentor_assignments ma on ma.mentor_id=mp.id
        where mp.user_id=$2 and ma.intern_id=s.intern_id and ma.started_at<=current_date and (ma.ended_at is null or ma.ended_at>=current_date))
      order by s.submitted_at desc`, [identity.roles.includes("super_admin"), identity.id]));
    return { submissions: result.rows };
  });
  app.patch("/v1/lms/submissions/:id/grade", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    const score = Number(request.body?.score);
    if (!validId(request.params.id) || !Number.isFinite(score) || score < 0 || score > 100) return reply.code(400).send({ error: "invalid_grade" });
    const result = await db.transaction(identity, async (client) => {
      const updated = await client.query(`update utero_academy.assignment_submissions s set score=$2,feedback=$3,reviewed_at=now()
        where s.id=$1 and ($4::boolean or exists(select 1 from utero_academy.mentor_profiles mp
          join utero_academy.mentor_assignments ma on ma.mentor_id=mp.id where mp.user_id=$5 and ma.intern_id=s.intern_id
          and ma.started_at<=current_date and (ma.ended_at is null or ma.ended_at>=current_date))) returning s.intern_id`,
        [request.params.id, score, request.body?.feedback || null, identity.roles.includes("super_admin"), identity.id]);
      if (!updated.rowCount) return null;
      const owner = await client.query("select user_id from utero_academy.intern_profiles where id=$1", [updated.rows[0].intern_id]);
      if (owner.rows[0]) await client.query("select utero_academy.check_and_award_badges($1,'assignment')", [owner.rows[0].user_id]);
      return updated.rows[0];
    });
    return result ? { submissionId: request.params.id } : reply.code(404).send({ error: "submission_not_found" });
  });

  app.get("/v1/lms/courses/:id/announcements", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_course_id" });
    const result = await db.transaction(identity, async (client) => {
      if (identity.roles.includes("intern")) {
        const profile = await internProfile(client, identity); if (!profile) return null;
        const enrolled = await client.query("select 1 from utero_academy.course_enrollments where course_id=$1 and intern_id=$2", [request.params.id, profile.id]);
        if (!enrolled.rowCount) return null;
      }
      return client.query(`select a.*,json_build_object('full_name',coalesce(p.full_name,u.email)) author,
        exists(select 1 from utero_academy.announcement_reads r where r.announcement_id=a.id and r.user_id=$2) is_read
        from utero_academy.course_announcements a join auth.users u on u.id=a.author_id
        left join utero_academy.user_profiles p on p.id=a.author_id where a.course_id=$1 and a.is_published
        order by a.is_pinned desc,a.published_at desc`, [request.params.id, identity.id]);
    });
    return result ? { announcements: result.rows } : reply.code(404).send({ error: "course_not_found" });
  });
  app.post("/v1/lms/courses/:id/announcements", async (request, reply) => {
    const identity = staff(request, reply); if (!identity) return;
    const name = title(request.body?.title); const content = String(request.body?.content ?? "").trim();
    const priority = request.body?.priority ?? "normal";
    if (!validId(request.params.id) || !name || !content || content.length > 20000 || !["low","normal","high","urgent"].includes(priority)) return reply.code(400).send({ error: "invalid_announcement" });
    const result = await db.transaction(identity, (client) => client.query(`insert into utero_academy.course_announcements
      (course_id,author_id,title,content,priority,is_pinned,is_published,published_at) values($1,$2,$3,$4,$5,$6,true,now()) returning *`,
      [request.params.id, identity.id, name, content, priority, request.body?.isPinned === true]));
    return reply.code(201).send({ announcement: result.rows[0] });
  });
  app.post("/v1/lms/announcements/:id/read", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    if (!validId(request.params.id)) return reply.code(400).send({ error: "invalid_announcement_id" });
    await db.transaction(identity, (client) => client.query(`insert into utero_academy.announcement_reads(announcement_id,user_id)
      values($1,$2) on conflict(announcement_id,user_id) do nothing`, [request.params.id, identity.id]));
    return reply.code(204).send();
  });

  app.get("/v1/lms/badges", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    const result = await db.transaction(identity, (client) => client.query("select * from utero_academy.badges where is_active order by category,points"));
    return { badges: result.rows };
  });
  app.get("/v1/lms/users/:id/achievements", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    const allowed = identity.id === request.params.id || identity.roles.some((role) => role === "admin" || role === "super_admin");
    if (!validId(request.params.id) || !allowed) return reply.code(403).send({ error: "forbidden" });
    const result = await db.transaction(identity, async (client) => {
      const [badges, points, streak] = await Promise.all([
        client.query(`select ub.*,row_to_json(b) badge from utero_academy.user_badges ub join utero_academy.badges b on b.id=ub.badge_id
          where ub.user_id=$1 order by ub.earned_at desc`, [request.params.id]),
        client.query("select * from utero_academy.user_points where user_id=$1", [request.params.id]),
        client.query("select * from utero_academy.user_streaks where user_id=$1", [request.params.id]),
      ]);
      return { badges: badges.rows, points: points.rows[0] ?? null, streak: streak.rows[0] ?? null };
    });
    return result;
  });
  app.get("/v1/lms/users/:id/activity", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    const allowed = identity.id === request.params.id || identity.roles.some((role) => role === "admin" || role === "super_admin");
    const days = Math.min(365, Math.max(1, Number.parseInt(request.query?.days ?? "30", 10) || 30));
    if (!validId(request.params.id) || !allowed) return reply.code(403).send({ error: "forbidden" });
    const result = await db.transaction(identity, (client) => client.query(
      "select * from utero_academy.daily_activity where user_id=$1 and activity_date>=current_date-$2::integer order by activity_date",
      [request.params.id, days],
    ));
    return { activity: result.rows };
  });
  app.post("/v1/lms/learning-sessions", async (request, reply) => {
    const identity = requireIdentity(request, reply); if (!identity) return;
    const duration = Number(request.body?.durationSeconds);
    if (request.body?.userId !== identity.id || !validId(request.body?.lessonId) || !validId(request.body?.courseId) || !Number.isInteger(duration) || duration < 1 || duration > 86400) return reply.code(400).send({ error: "invalid_session" });
    await db.transaction(identity, async (client) => {
      const profile = await internProfile(client, identity); if (!profile) return false;
      const access = await client.query(`select 1 from utero_academy.lessons l join utero_academy.course_enrollments e on e.course_id=l.course_id
        where l.id=$1 and l.course_id=$2 and e.intern_id=$3`, [request.body.lessonId, request.body.courseId, profile.id]);
      if (!access.rowCount) return false;
      await client.query(`insert into utero_academy.learning_sessions(user_id,lesson_id,course_id,started_at,ended_at,duration_seconds,activity_type)
        values($1,$2,$3,now()-($4::text||' seconds')::interval,now(),$4,'lesson_view')`, [identity.id, request.body.lessonId, request.body.courseId, duration]);
      await client.query("select utero_academy.update_daily_activity($1,'lesson_view',$2,0)", [identity.id, duration]);
      await client.query("select utero_academy.update_user_streak($1)", [identity.id]);
      return true;
    });
    return reply.code(204).send();
  });
}
