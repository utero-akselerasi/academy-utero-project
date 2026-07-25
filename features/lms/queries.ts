import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

export async function getInternEnrollments(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  
  const { data: enrollments, error } = await db
    .from("course_enrollments")
    .select("course_id, enrolled_at, completed_at, courses(id, title, description, slug)")
    .eq("intern_id", internProfileId);

  if (error || !enrollments) {
    return { data: [], error };
  }

  const mapped = enrollments.map(e => {
    const c = Array.isArray(e.courses) ? e.courses[0] : e.courses;
    return {
      course_id: e.course_id,
      enrolled_at: e.enrolled_at,
      completed_at: e.completed_at,
      course: c
    };
  });

  return { data: mapped, error: null };
}

export async function getCourseDetails(courseId: string, internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const [courseRes, lessonsRes, quizzesRes, assignmentsRes, progressRes, quizAttemptsRes, submissionsRes] = await Promise.all([
    db.from("courses").select("id, title, description, slug").eq("id", courseId).maybeSingle(),
    db.from("lessons").select("id, course_id, title, order_index, is_published, attachments").eq("course_id", courseId).order("order_index", { ascending: true }),
    db.from("quizzes").select("id, course_id, title, passing_score, is_published").eq("course_id", courseId),
    db.from("assignments").select("id, course_id, title, description, due_at, is_published").eq("course_id", courseId),
    db.from("lesson_progress").select("lesson_id, completed_at").eq("intern_id", internProfileId),
    db.from("quiz_attempts").select("quiz_id, score, submitted_at").eq("intern_id", internProfileId),
    db.from("assignment_submissions").select("assignment_id, score, reviewed_at").eq("intern_id", internProfileId)
  ]);

  if (courseRes.error || !courseRes.data) {
    return { data: null, error: courseRes.error };
  }

  const progressMap = new Map(progressRes.data?.map(p => [p.lesson_id, p.completed_at]));
  const quizMap = new Map(quizAttemptsRes.data?.map(q => [q.quiz_id, q.score]));
  const submissionMap = new Map(submissionsRes.data?.map(s => [s.assignment_id, s]));

  const lessons = (lessonsRes.data || []).filter(l => l.is_published !== false).map(l => ({
    ...l,
    is_completed: progressMap.has(l.id)
  }));

  const quizzes = (quizzesRes.data || []).filter(q => q.is_published !== false).map(q => ({
    ...q,
    best_score: quizMap.get(q.id) ?? null
  }));

  const assignments = (assignmentsRes.data || []).filter(a => a.is_published !== false).map(a => {
    const sub = submissionMap.get(a.id);
    return {
      ...a,
      submission: sub ? {
        score: sub.score,
        reviewed_at: sub.reviewed_at
      } : null
    };
  });

  return {
    data: {
      course: courseRes.data,
      lessons,
      quizzes,
      assignments
    },
    error: null
  };
}

export async function getLesson(lessonId: string, internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data: lesson, error } = await db
    .from("lessons")
    .select("id, course_id, title, content, video_url, order_index, is_published, attachments")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !lesson || lesson.is_published === false) {
    return { data: null, error: error || new Error("Materi belum dipublikasikan.") };
  }

  const { data: progress } = await db
    .from("lesson_progress")
    .select("completed_at")
    .eq("lesson_id", lessonId)
    .eq("intern_id", internProfileId)
    .maybeSingle();

  return {
    data: {
      ...lesson,
      is_completed: !!progress?.completed_at
    },
    error: null
  };
}

export async function getQuiz(quizId: string, internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data: quiz, error } = await db
    .from("quizzes")
    .select("id, course_id, title, questions, passing_score, is_published")
    .eq("id", quizId)
    .maybeSingle();

  if (error || !quiz || quiz.is_published === false) {
    return { data: null, error: error || new Error("Kuis belum dipublikasikan.") };
  }

  const { data: attempts } = await db
    .from("quiz_attempts")
    .select("id, score, answers, submitted_at")
    .eq("quiz_id", quizId)
    .eq("intern_id", internProfileId)
    .order("submitted_at", { ascending: false });

  return {
    data: {
      ...quiz,
      attempts: attempts ?? []
    },
    error: null
  };
}

export async function getAssignment(assignmentId: string, internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data: assignment, error } = await db
    .from("assignments")
    .select("id, course_id, title, description, due_at, is_published")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error || !assignment || assignment.is_published === false) {
    return { data: null, error: error || new Error("Tugas belum dipublikasikan.") };
  }

  const { data: submission } = await db
    .from("assignment_submissions")
    .select("id, content, attachment_path, score, feedback, submitted_at, reviewed_at")
    .eq("assignment_id", assignmentId)
    .eq("intern_id", internProfileId)
    .maybeSingle();

  return {
    data: {
      ...assignment,
      submission: submission ?? null
    },
    error: null
  };
}

export async function getMentorSubmissions(mentorProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data: assignments } = await db
    .from("mentor_assignments")
    .select("intern_id")
    .eq("mentor_id", mentorProfileId);

  if (!assignments || assignments.length === 0) {
    return { data: [], error: null };
  }

  const internIds = assignments.map(a => a.intern_id);

  const { data: submissions, error } = await db
    .from("assignment_submissions")
    .select("id, assignment_id, intern_id, content, attachment_path, score, feedback, submitted_at, reviewed_at, assignments(title), intern_profiles(full_name)")
    .in("intern_id", internIds)
    .order("submitted_at", { ascending: false })
    .returns<any[]>();

  if (error || !submissions) {
    return { data: [], error };
  }

  const mapped = submissions.map(s => {
    const a = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
    const ip = Array.isArray(s.intern_profiles) ? s.intern_profiles[0] : s.intern_profiles;
    return {
      id: s.id,
      assignment_id: s.assignment_id,
      intern_id: s.intern_id,
      content: s.content,
      attachment_path: s.attachment_path,
      score: s.score,
      feedback: s.feedback,
      submitted_at: s.submitted_at,
      reviewed_at: s.reviewed_at,
      assignment_title: a?.title || "Tugas Tanpa Judul",
      intern_name: ip?.full_name || "Peserta"
    };
  });

  return { data: mapped, error: null };
}

export async function getAllCourses() {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("courses")
    .select("id, title, description, slug, status")
    .order("title", { ascending: true });
    
  return { data: data ?? [], error };
}

export async function getMentorCourseDetails(courseId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const [courseRes, lessonsRes, quizzesRes, assignmentsRes] = await Promise.all([
    db.from("courses").select("id, title, description, slug").eq("id", courseId).maybeSingle(),
    db.from("lessons").select("id, course_id, title, content, video_url, order_index, is_published, attachments").eq("course_id", courseId).order("order_index", { ascending: true }),
    db.from("quizzes").select("id, course_id, title, passing_score, is_published").eq("course_id", courseId),
    db.from("assignments").select("id, course_id, title, description, due_at, is_published").eq("course_id", courseId)
  ]);

  if (courseRes.error || !courseRes.data) {
    return { data: null, error: courseRes.error };
  }

  return {
    data: {
      course: courseRes.data,
      lessons: lessonsRes.data || [],
      quizzes: quizzesRes.data || [],
      assignments: assignmentsRes.data || []
    },
    error: null
  };
}
