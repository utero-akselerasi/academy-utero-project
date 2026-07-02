"use server";

import { createSupabaseServerClient, createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getInternProfileId, getMentorProfileId } from "@/features/daily-reports/queries";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
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

  // Cek apakah semua lesson di course ini sudah selesai untuk meng-update course enrollment
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
  }

  revalidatePath(`/dashboard/intern/lms/${courseId}`);
  revalidatePath(`/dashboard/intern/lms/${courseId}/lessons/${lessonId}`);
}

export async function submitQuizAttemptAction(formData: FormData) {
  const user = await requireUser();
  const quizId = formData.get("quizId") as string;
  const courseId = formData.get("courseId") as string;
  
  if (!quizId) throw new Error("Quiz ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta belum ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();

  // Dapatkan kuis asli untuk mencocokkan kunci jawaban
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
    score
  });

  if (insertErr) {
    console.error("Gagal simpan skor kuis:", insertErr);
    throw new Error("Gagal mengumpulkan kuis.");
  }

  revalidatePath(`/dashboard/intern/lms/${courseId}`);
  redirect(`/dashboard/intern/lms/${courseId}/quizzes/${quizId}`);
}

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

  // Jika ada file bukti tugas yang diupload, gunakan service role storage untuk upload
  if (file && file.size > 0) {
    const supabase = createSupabaseServiceRoleClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `assignment/${assignmentId}/${internProfileId}_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("learning") // Bucket learning untuk materi/tugas
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

  // Simpan/update submission di database
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
        attachment_path: attachmentUrl || undefined, // pertahankan yang lama jika tidak upload file baru
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
    throw new Error("Nilai harus berupa angka antara 0 s.d. 100.");
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
    console.error("Gagal menilai tugas:", error);
    throw new Error("Gagal menyimpan penilaian.");
  }

  revalidatePath("/dashboard/mentor/lms");
}

export async function createLessonAction(formData: FormData) {
  await requireUser();
  const courseId = formData.get("courseId") as string;
  const title = formData.get("title") as string;
  const contentText = formData.get("content") as string;
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
    content: { text: contentText || "" },
    video_url: videoUrl || null,
    order_index: nextOrder
  });

  if (error) {
    console.error("Gagal buat lesson:", error);
    throw new Error("Gagal membuat materi baru.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
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
    due_at: dueAt ? new Date(dueAt).toISOString() : null
  });

  if (error) {
    console.error("Gagal buat assignment:", error);
    throw new Error("Gagal membuat tugas baru.");
  }

  // Kirim notifikasi tugas baru
  try {
    const { data: course } = await db
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .maybeSingle();
    const courseTitle = course?.title || "Materi LMS";

    const { data: interns } = await db
      .from("intern_profiles")
      .select("full_name, email, phone")
      .eq("status", "active");

    if (interns && interns.length > 0) {
      const { notifyNewAssignmentCreated } = require("@/lib/notification");
      const mappedInterns = interns.map(i => ({
        name: i.full_name,
        email: i.email,
        phone: i.phone
      }));
      await notifyNewAssignmentCreated(mappedInterns, courseTitle, title);
    }
  } catch (err) {
    console.error("Gagal memproses notifikasi tugas baru:", err);
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}


export async function createCourseAction(formData: FormData) {
  await requireUser();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  if (!title) throw new Error("Judul course wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const { error } = await db.from("courses").insert({
    title,
    slug,
    description: description || null,
    status: "published"
  });

  if (error) {
    console.error("Gagal buat course:", error);
    throw new Error("Gagal membuat kelas baru.");
  }

  revalidatePath("/dashboard/mentor/lms");
}

export async function createQuizAction(formData: FormData) {
  await requireUser();
  const courseId = formData.get("courseId") as string;
  const title = formData.get("title") as string;
  const passingScoreStr = formData.get("passingScore") as string;
  const questionsJsonStr = formData.get("questionsJson") as string;

  if (!courseId || !title) throw new Error("Course ID dan Judul kuis wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();

  let questions = [];
  try {
    if (questionsJsonStr) {
      questions = JSON.parse(questionsJsonStr);
    }
  } catch (err) {
    throw new Error("Format JSON pertanyaan kuis tidak valid.");
  }

  const { error } = await db.from("quizzes").insert({
    course_id: courseId,
    title,
    questions,
    passing_score: passingScoreStr ? parseFloat(passingScoreStr) : 70
  });

  if (error) {
    console.error("Gagal buat kuis:", error);
    throw new Error("Gagal membuat kuis baru.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}


export async function enrollCourseAction(formData: FormData) {
  const user = await requireUser();
  const courseId = formData.get("courseId") as string;
  if (!courseId) throw new Error("Course ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta tidak ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("course_enrollments").insert({
    course_id: courseId,
    intern_id: internProfileId,
    enrolled_at: new Date().toISOString()
  });

  if (error && error.code !== "23505") {
    console.error("Gagal join course:", error);
    throw new Error("Gagal mengikuti kelas.");
  }

  revalidatePath("/dashboard/intern/lms");
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
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("id", lessonId);

  if (error) {
    console.error("Gagal toggle status publish lesson:", error);
    throw new Error("Gagal mengubah status publikasi materi.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
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
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("id", quizId);

  if (error) {
    console.error("Gagal toggle status publish quiz:", error);
    throw new Error("Gagal mengubah status publikasi kuis.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
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
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (error) {
    console.error("Gagal toggle status publish assignment:", error);
    throw new Error("Gagal mengubah status publikasi tugas.");
  }

  revalidatePath("/dashboard/mentor/lms/" + courseId);
}
