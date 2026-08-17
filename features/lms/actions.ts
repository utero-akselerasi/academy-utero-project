"use server";

import { createSupabaseServerClient, createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getInternProfileId, getMentorProfileId } from "@/features/daily-reports/queries";
import { generateCourseCertificate } from "./certificate-helper";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

// ===== LESSON ACTIONS =====

export async function createLessonAction(formData: FormData) {
  await requireUser();
  const courseId = formData.get("courseId") as string;
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const videoUrl = formData.get("videoUrl") as string;

  if (!courseId || !title) throw new Error("Course ID dan Judul wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();

  const { data: maxOrder } = await db
    .from("lessons")
    .select("order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("lessons").insert({
    course_id: courseId,
    title,
    content: content || "",
    video_url: videoUrl || null,
    order_index: nextOrder
  });

  if (error) {
    console.error("Gagal buat lesson:", error);
    throw new Error("Gagal membuat materi baru.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}

export async function updateLessonAction(formData: FormData) {
  await requireUser();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const videoUrl = formData.get("videoUrl") as string;

  if (!lessonId || !title) throw new Error("Lesson ID dan Judul wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("lessons")
    .update({
      title,
      content: content || "",
      video_url: videoUrl || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", lessonId);

  if (error) {
    console.error("Gagal update lesson:", error);
    throw new Error("Gagal memperbarui materi.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}

export async function deleteLessonAction(formData: FormData) {
  await requireUser();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;

  if (!lessonId) throw new Error("Lesson ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("lessons")
    .delete()
    .eq("id", lessonId);

  if (error) {
    console.error("Gagal hapus lesson:", error);
    throw new Error("Gagal menghapus materi.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}

export async function toggleLessonPublishAction(formData: FormData) {
  await requireUser();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const isPublished = formData.get("isPublished") === "true";

  if (!lessonId) throw new Error("Lesson ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("lessons")
    .update({ is_published: isPublished })
    .eq("id", lessonId);

  if (error) {
    console.error("Gagal toggle lesson publish:", error);
    throw new Error("Gagal mengubah status publish lesson.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}

export async function uploadLessonAttachmentAction(formData: FormData) {
  await requireUser();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const file = formData.get("file") as File;

  if (!lessonId || !file) throw new Error("Lesson ID dan file wajib diisi.");

  const supabase = createSupabaseServiceRoleClient();
  const db = await createUteroAcademyServiceRoleClient();

  const ext = file.name.split(".").pop() || "pdf";
  const filePath = `lessons/${lessonId}/${Date.now()}_${file.name}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("learning")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    console.error("Gagal upload attachment:", uploadError);
    throw new Error("Gagal mengunggah file.");
  }

  const { data: { publicUrl } } = supabase.storage.from("learning").getPublicUrl(filePath);

  const { data: lesson } = await db
    .from("lessons")
    .select("attachments")
    .eq("id", lessonId)
    .maybeSingle();

  const currentAttachments = Array.isArray(lesson?.attachments) ? lesson.attachments : [];
  
  const newAttachment = {
    id: crypto.randomUUID(),
    name: file.name,
    path: publicUrl,
    size: file.size,
    type: file.type,
    uploaded_at: new Date().toISOString()
  };

  const { error } = await db
    .from("lessons")
    .update({
      attachments: [...currentAttachments, newAttachment]
    })
    .eq("id", lessonId);

  if (error) {
    console.error("Gagal update attachments:", error);
    throw new Error("Gagal menyimpan attachment.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
  revalidatePath("/dashboard/intern/lms/" + courseId + "/lessons/" + lessonId);
}

export async function deleteLessonAttachmentAction(formData: FormData) {
  await requireUser();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const attachmentId = formData.get("attachmentId") as string;

  if (!lessonId || !attachmentId) throw new Error("Lesson ID dan Attachment ID wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();

  const { data: lesson } = await db
    .from("lessons")
    .select("attachments")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) throw new Error("Lesson tidak ditemukan.");

  const currentAttachments = Array.isArray(lesson.attachments) ? lesson.attachments : [];
  const updatedAttachments = currentAttachments.filter((a: any) => a.id !== attachmentId);

  const { error } = await db
    .from("lessons")
    .update({
      attachments: updatedAttachments
    })
    .eq("id", lessonId);

  if (error) {
    console.error("Gagal delete attachment:", error);
    throw new Error("Gagal menghapus attachment.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
  revalidatePath("/dashboard/intern/lms/" + courseId + "/lessons/" + lessonId);
}

export async function markLessonCompletedAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  
  if (!lessonId) throw new Error("Lesson ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta belum ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("lesson_progress").insert({
    lesson_id: lessonId,
    intern_id: internProfileId,
    completed_at: new Date().toISOString(),
    progress_percent: 100
  });

  if (error && error.code !== "23505") {
    console.error("Gagal tandai lesson selesai:", error);
    throw new Error("Gagal menandai pelajaran selesai.");
  }

  const { data: lessons } = await db.from("lessons").select("id").eq("course_id", courseId);
  const { data: completed } = await db
    .from("lesson_progress")
    .select("lesson_id")
    .eq("intern_id", internProfileId)
    .in("lesson_id", lessons?.map(l => l.id) || []);

  if (lessons && completed && lessons.length === completed.length) {
    await db
      .from("course_enrollments")
      .update({ completed_at: new Date().toISOString() })
      .eq("course_id", courseId)
      .eq("intern_id", internProfileId);

    await generateCourseCertificate(internProfileId, courseId);
  }

  revalidatePath(`/dashboard/intern/lms/${courseId}`);
  revalidatePath(`/dashboard/intern/lms/${courseId}/lessons/${lessonId}`);
}

// ===== QUIZ ACTIONS =====

export async function submitQuizAttemptAction(formData: FormData) {
  const user = await requireUser();
  const quizId = formData.get("quizId") as string;
  const courseId = formData.get("courseId") as string;
  
  if (!quizId) throw new Error("Quiz ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta belum ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();

  const { data: quiz, error: quizErr } = await db
    .from("quizzes")
    .select("questions")
    .eq("id", quizId)
    .maybeSingle();

  if (quizErr || !quiz) {
    throw new Error("Kuis tidak ditemukan.");
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const answers: { question_id: string; selected_option: string }[] = [];
  
  let correctCount = 0;

  for (const q of questions) {
    const ans = formData.get("q_" + q.id) as string;
    answers.push({
      question_id: q.id,
      selected_option: ans || ""
    });

    if (ans === q.correct_answer) {
      correctCount++;
    }
  }

  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const { error: insertErr } = await db.from("quiz_attempts").insert({
    quiz_id: quizId,
    intern_id: internProfileId,
    answers,
    score,
    finished_at: new Date().toISOString()
  });

  if (insertErr) {
    console.error("Gagal simpan skor kuis:", insertErr);
    throw new Error("Gagal mengumpulkan kuis.");
  }

  revalidatePath(`/dashboard/intern/lms/${courseId}`);
  redirect(`/dashboard/intern/lms/${courseId}/quizzes/${quizId}`);
}

export async function toggleQuizPublishAction(formData: FormData) {
  await requireUser();
  const quizId = formData.get("quizId") as string;
  const courseId = formData.get("courseId") as string;
  const isPublished = formData.get("isPublished") === "true";

  if (!quizId) throw new Error("Quiz ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("quizzes")
    .update({ is_published: isPublished })
    .eq("id", quizId);

  if (error) {
    console.error("Gagal toggle quiz publish:", error);
    throw new Error("Gagal mengubah status publish quiz.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}

// ===== ASSIGNMENT ACTIONS =====

export async function submitAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = formData.get("assignmentId") as string;
  const courseId = formData.get("courseId") as string;
  const content = formData.get("content") as string;
  const file = formData.get("attachment") as File;

  if (!assignmentId) throw new Error("Assignment ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta belum ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();
  let attachmentUrl: string | null = null;

  if (file && file.size > 0) {
    const supabase = createSupabaseServiceRoleClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `assignment/${assignmentId}/${internProfileId}_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("learning")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error("Gagal upload assignment attachment:", uploadError);
      throw new Error("Gagal mengunggah file bukti tugas.");
    }

    const { data: { publicUrl } } = supabase.storage.from("learning").getPublicUrl(filePath);
    attachmentUrl = publicUrl;
  }

  const { data: existing } = await db
    .from("assignment_submissions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("intern_id", internProfileId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("assignment_submissions")
      .update({
        content: content || null,
        attachment_path: attachmentUrl || undefined,
        submitted_at: new Date().toISOString()
      })
      .eq("id", existing.id);

    if (error) {
      console.error("Gagal update submission:", error);
      throw new Error("Gagal mengumpulkan tugas.");
    }
  } else {
    const { error } = await db.from("assignment_submissions").insert({
      assignment_id: assignmentId,
      intern_id: internProfileId,
      content: content || null,
      attachment_path: attachmentUrl
    });

    if (error) {
      console.error("Gagal insert submission:", error);
      throw new Error("Gagal mengumpulkan tugas.");
    }
  }

  revalidatePath(`/dashboard/intern/lms/${courseId}`);
  redirect(`/dashboard/intern/lms/${courseId}/assignments/${assignmentId}`);
}

export async function gradeAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const submissionId = formData.get("submissionId") as string;
  const scoreRaw = formData.get("score") as string;
  const feedback = formData.get("feedback") as string;

  if (!submissionId) throw new Error("Submission ID tidak valid.");

  const score = parseFloat(scoreRaw);
  if (isNaN(score) || score < 0 || score > 100) {
    throw new Error("Skor harus antara 0-100.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("assignment_submissions")
    .update({
      score,
      feedback: feedback || null,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", submissionId);

  if (error) {
    console.error("Gagal nilai tugas:", error);
    throw new Error("Gagal menyimpan penilaian.");
  }

  revalidatePath("/dashboard/mentor/lms");
}

export async function toggleAssignmentPublishAction(formData: FormData) {
  await requireUser();
  const assignmentId = formData.get("assignmentId") as string;
  const courseId = formData.get("courseId") as string;
  const isPublished = formData.get("isPublished") === "true";

  if (!assignmentId) throw new Error("Assignment ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("assignments")
    .update({ is_published: isPublished })
    .eq("id", assignmentId);

  if (error) {
    console.error("Gagal toggle assignment publish:", error);
    throw new Error("Gagal mengubah status publish assignment.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}

// ===== COURSE ACTIONS =====

export async function createCourseAction(formData: FormData) {
  await requireUser();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  if (!title) throw new Error("Judul course wajib diisi.");

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("courses").insert({
    title,
    slug,
    description: description || null,
    status: "draft"
  });

  if (error) {
    console.error("Gagal buat course:", error);
    throw new Error("Gagal membuat course baru.");
  }

  revalidatePath("/dashboard/mentor/lms");
}

export async function updateCourseStatusAction(formData: FormData) {
  await requireUser();
  const courseId = formData.get("courseId") as string;
  const status = formData.get("status") as string;

  if (!courseId || !status) throw new Error("Course ID dan status wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("courses")
    .update({ status })
    .eq("id", courseId);

  if (error) {
    console.error("Gagal update status course:", error);
    throw new Error("Gagal memperbarui status course.");
  }

  revalidatePath("/dashboard/mentor/lms");
}

export async function enrollCourseAction(formData: FormData) {
  const user = await requireUser();
  const courseId = formData.get("courseId") as string;

  if (!courseId) throw new Error("Course ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta belum ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("course_enrollments").insert({
    course_id: courseId,
    intern_id: internProfileId
  });

  if (error) {
    console.error("Gagal enroll course:", error);
    throw new Error("Gagal mendaftar ke course.");
  }

  revalidatePath("/dashboard/intern/lms");
  redirect("/dashboard/intern/lms/" + courseId);
}

export async function createAssignmentAction(formData: FormData) {
  await requireUser();
  const courseId = formData.get("courseId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const dueAt = formData.get("dueAt") as string;

  if (!courseId || !title) throw new Error("Course ID dan Judul wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("assignments").insert({
    course_id: courseId,
    title,
    description: description || null,
    due_at: dueAt || null
  });

  if (error) {
    console.error("Gagal buat assignment:", error);
    throw new Error("Gagal membuat tugas baru.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}

export async function createQuizAction(formData: FormData) {
  await requireUser();
  const courseId = formData.get("courseId") as string;
  const title = formData.get("title") as string;
  const passingScore = formData.get("passingScore") as string;
  const timeLimitMinutes = formData.get("timeLimitMinutes") as string;
  const questionsJson = formData.get("questions") as string;

  if (!courseId || !title) throw new Error("Course ID dan Judul wajib diisi.");

  let questions = [];
  try {
    questions = JSON.parse(questionsJson || "[]");
  } catch (e) {
    throw new Error("Format pertanyaan tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("quizzes").insert({
    course_id: courseId,
    title,
    questions,
    passing_score: passingScore ? parseFloat(passingScore) : null,
    time_limit_minutes: timeLimitMinutes ? parseInt(timeLimitMinutes) : null
  });

  if (error) {
    console.error("Gagal buat quiz:", error);
    throw new Error("Gagal membuat kuis baru.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}

// ===== COMMENTS ACTIONS =====

export async function createCommentAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const content = formData.get("content") as string;

  if (!lessonId || !content) throw new Error("Lesson ID dan konten wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("lesson_comments").insert({
    lesson_id: lessonId,
    user_id: user.id,
    content: content.trim()
  });

  if (error) {
    console.error("Gagal buat comment:", error);
    throw new Error("Gagal mengirim komentar.");
  }

  revalidatePath(`/dashboard/intern/lms/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/mentor/lms/${courseId}`);
}

export async function replyCommentAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const parentCommentId = formData.get("parentCommentId") as string;
  const content = formData.get("content") as string;

  if (!lessonId || !parentCommentId || !content) {
    throw new Error("Data tidak lengkap.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("lesson_comments").insert({
    lesson_id: lessonId,
    user_id: user.id,
    parent_comment_id: parentCommentId,
    content: content.trim()
  });

  if (error) {
    console.error("Gagal buat reply:", error);
    throw new Error("Gagal mengirim balasan.");
  }

  revalidatePath(`/dashboard/intern/lms/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/mentor/lms/${courseId}`);
}

export async function pinCommentAction(formData: FormData) {
  const user = await requireUser();
  const commentId = formData.get("commentId") as string;
  const courseId = formData.get("courseId") as string;
  const isPinned = formData.get("isPinned") === "true";

  if (!commentId) throw new Error("Comment ID tidak valid.");

  const mentorProfileId = await getMentorProfileId(user.id);
  if (!mentorProfileId) {
    throw new Error("Hanya mentor/admin yang dapat pin komentar.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("lesson_comments")
    .update({ is_pinned: isPinned })
    .eq("id", commentId);

  if (error) {
    console.error("Gagal pin comment:", error);
    throw new Error("Gagal pin komentar.");
  }

  revalidatePath(`/dashboard/mentor/lms/${courseId}`);
  revalidatePath(`/dashboard/intern/lms/${courseId}`);
}

export async function deleteCommentAction(formData: FormData) {
  const user = await requireUser();
  const commentId = formData.get("commentId") as string;
  const courseId = formData.get("courseId") as string;

  if (!commentId) throw new Error("Comment ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();

  const { data: comment } = await db
    .from("lesson_comments")
    .select("user_id, lesson_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) throw new Error("Komentar tidak ditemukan.");

  const mentorProfileId = await getMentorProfileId(user.id);
  const isOwner = comment.user_id === user.id;
  const isMentor = !!mentorProfileId;

  if (!isOwner && !isMentor) {
    throw new Error("Anda tidak memiliki akses untuk menghapus komentar ini.");
  }

  const { error } = await db
    .from("lesson_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Gagal delete comment:", error);
    throw new Error("Gagal menghapus komentar.");
  }

  revalidatePath(`/dashboard/intern/lms/${courseId}/lessons/${comment.lesson_id}`);
  revalidatePath(`/dashboard/mentor/lms/${courseId}`);
}

// ============================================
// PRIORITY 2: USER ENGAGEMENT ACTIONS
// ============================================

// Badges & Achievements
export async function getUserBadges(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("user_badges")
    .select(`
      *,
      badge:badges(*)
    `)
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getUserPoints(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("user_points")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function getAllBadges() {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("badges")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("points", { ascending: true });

  if (error) throw error;
  return data;
}

// Learning Analytics
export async function getUserDailyActivity(userId: string, days: number = 30) {
  const db = await createUteroAcademyServiceRoleClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await db
    .from("daily_activity")
    .select("*")
    .eq("user_id", userId)
    .gte("activity_date", startDate.toISOString().split("T")[0])
    .order("activity_date", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getUserStreak(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("user_streaks")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function trackLearningSession(
  userId: string,
  lessonId: string,
  courseId: string,
  durationSeconds: number
) {
  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db
    .from("learning_sessions")
    .insert({
      user_id: userId,
      lesson_id: lessonId,
      course_id: courseId,
      started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      activity_type: "lesson_view",
    });

  if (error) throw error;

  // Update daily activity
  await db.rpc("update_daily_activity", {
    p_user_id: userId,
    p_activity_type: "lesson_view",
    p_time_seconds: durationSeconds,
    p_points: 0,
  });

  // Update streak
  await db.rpc("update_user_streak", { p_user_id: userId });
}

// Course Announcements
export async function getCourseAnnouncements(courseId: string, userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("course_announcements")
    .select(`
      *,
      author:users!course_announcements_author_id_fkey(full_name),
      reads:announcement_reads!left(user_id)
    `)
    .eq("course_id", courseId)
    .eq("is_published", true)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) throw error;

  // Add is_read flag
  return data.map((announcement: any) => ({
    ...announcement,
    is_read: announcement.reads?.some((r: any) => r.user_id === userId) || false,
  }));
}

export async function createCourseAnnouncement(
  courseId: string,
  title: string,
  content: string,
  priority: string = "normal",
  isPinned: boolean = false
) {
  const user = await requireUser();
  const db = await createUteroAcademyServiceRoleClient();

  const mentorProfileId = await getMentorProfileId(user.id);
  if (!mentorProfileId) {
    throw new Error("Hanya mentor yang dapat membuat announcement.");
  }

  const { data, error } = await db
    .from("course_announcements")
    .insert({
      course_id: courseId,
      author_id: user.id,
      title,
      content,
      priority,
      is_pinned: isPinned,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath(`/dashboard/intern/lms/${courseId}`);
  revalidatePath(`/dashboard/mentor/lms/${courseId}`);
  return data;
}

export async function markAnnouncementAsRead(announcementId: string) {
  const user = await requireUser();
  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("announcement_reads")
    .upsert(
      {
        announcement_id: announcementId,
        user_id: user.id,
      },
      {
        onConflict: "announcement_id,user_id",
        ignoreDuplicates: true,
      }
    );

  if (error) throw error;
}

// Lesson Bookmarks
export async function getUserBookmarks(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("lesson_bookmarks")
    .select(`
      *,
      lesson:lessons(title, course_id)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function toggleLessonBookmark(
  lessonId: string,
  note?: string
) {
  const user = await requireUser();
  const db = await createUteroAcademyServiceRoleClient();

  // Check if already bookmarked
  const { data: existing } = await db
    .from("lesson_bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .single();

  if (existing) {
    // Remove bookmark
    const { error } = await db
      .from("lesson_bookmarks")
      .delete()
      .eq("id", existing.id);

    if (error) throw error;
    return { bookmarked: false };
  } else {
    // Add bookmark
    const { error } = await db
      .from("lesson_bookmarks")
      .insert({
        user_id: user.id,
        lesson_id: lessonId,
        note,
      });

    if (error) throw error;
    return { bookmarked: true };
  }
}

export async function deleteBookmark(bookmarkId: string) {
  const user = await requireUser();
  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db
    .from("lesson_bookmarks")
    .delete()
    .eq("id", bookmarkId)
    .eq("user_id", user.id);

  if (error) throw error;
}

// Quiz Retry Limit
export async function checkCanAttemptQuiz(userId: string, quizId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.rpc("can_attempt_quiz", {
    p_user_id: userId,
    p_quiz_id: quizId,
  });

  if (error) throw error;
  return data?.[0] || null;
}

export async function getQuizAttemptsSummary(userId: string, quizId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("user_quiz_attempts_summary")
    .select("*")
    .eq("user_id", userId)
    .eq("quiz_id", quizId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}
