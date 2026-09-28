"use server";

import { requireAdmin, requireUser } from "@/features/auth/guards";
import { getUserRoleCodes } from "@/features/auth/roles";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { internIsEnrolled } from "./queries";
import { generateCourseCertificate } from "./certificate-helper";

/**
 * Pengelolaan course/lesson/quiz/assignment adalah pekerjaan staff.
 * Guard lama hanya memeriksa sesi, sehingga peserta bisa membuat/menghapus
 * materi dan menilai tugas lewat pemanggilan action ID langsung.
 */
const requireStaff = requireAdmin;

async function userIsStaff(userId: string) {
  const roles = await getUserRoleCodes(userId);
  return roles.includes("super_admin") || roles.includes("admin");
}

/**
 * Data per-user hanya boleh dibaca oleh pemiliknya atau staff.
 * Tanpa ini, setiap fungsi eksport di file "use server" bisa dipanggil dengan
 * userId orang lain dan membaca datanya lewat service role (IDOR).
 */
async function requireSelfOrStaff(targetUserId: string) {
  const user = await requireUser();
  if (user.id === targetUserId) return user;
  if (await userIsStaff(user.id)) return user;
  throw new Error("Kamu tidak punya akses ke data pengguna ini.");
}

// ===== LESSON ACTIONS =====

export async function createLessonAction(formData: FormData) {
  await requireStaff();
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
  await requireStaff();
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
  await requireStaff();
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
  await requireStaff();
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
  await requireStaff();
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const file = formData.get("file") as File;

  if (!lessonId || !file) throw new Error("Lesson ID dan file wajib diisi.");

  // Tipe & ekstensi dari isi berkas. Path lama menyisipkan file.name mentah
  // dari klien, jadi nama berkas bisa menyuntikkan segmen path ke bucket.
  let attachment;
  try {
    attachment = await validateUpload(file, ["image", "document"]);
  } catch (error) {
    if (error instanceof UploadValidationError) throw new Error(error.message);
    console.error("Gagal memvalidasi attachment lesson:", error);
    throw new Error("Berkas materi tidak dapat diproses.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const db = await createUteroAcademyServiceRoleClient();

  // Lesson dibaca DULU, sebelum apa pun diunggah. Dua alasan:
  //
  // 1. `lessonId` datang mentah dari `formData` dan dulu hanya diperiksa
  //    tidak-kosong, lalu langsung disisipkan ke segmen path storage
  //    (`lessons/${lessonId}`). Nilai seperti `../../avatars/settings` membuat
  //    unggahan mendarat di prefix lain. Yang dipakai membangun path sekarang
  //    adalah `lesson.id` — UUID dari baris DB, bukan teks dari klien. Polanya
  //    sama dengan `requireCardAccess` di `features/tasks/actions.ts`.
  // 2. Urutan lama mengunggah lebih dulu, jadi `lessonId` yang tidak cocok baris
  //    mana pun meninggalkan objek yatim di bucket — nol `storage.remove()` di
  //    seluruh repo, jadi tak ada yang membersihkannya.
  const { data: lesson, error: lessonError } = await db
    .from("lessons")
    .select("id, attachments")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError) {
    console.error("Gagal membaca lesson:", lessonError);
    throw new Error("Materi tidak dapat diverifikasi.");
  }
  if (!lesson) {
    throw new Error("Materi tidak ditemukan.");
  }

  const filePath = buildStoragePath(`lessons/${lesson.id}`, attachment.ext);

  const { error: uploadError } = await supabase.storage
    .from("learning")
    .upload(filePath, attachment.buffer, {
      contentType: attachment.contentType,
      upsert: false
    });

  if (uploadError) {
    console.error("Gagal upload attachment:", uploadError);
    throw new Error("Gagal mengunggah file.");
  }

  const currentAttachments = Array.isArray(lesson.attachments) ? lesson.attachments : [];

  // Kunci `path` menyimpan OBJECT PATH, bukan URL publik. Bucket `learning`
  // memang sudah privat di seed `0002_storage_buckets.sql`; 0007 yang memaksanya
  // publik. Pembacaannya lewat `signLessonAttachments()` di
  // `features/lms/queries.ts`.
  const newAttachment = {
    id: crypto.randomUUID(),
    name: attachment.displayName,
    path: filePath,
    size: attachment.size,
    type: attachment.contentType,
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
  await requireStaff();
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

  if (!lessonId) throw new Error("Lesson ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta belum ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();

  // courseId diturunkan dari baris lesson, BUKAN dari formData. Versi lama
  // memakai courseId kiriman klien untuk menghitung kelengkapan course, jadi
  // peserta bisa mengirim courseId course kosong: jumlah lesson 0 == jumlah
  // lesson selesai 0, course ditandai lulus, dan sertifikat diterbitkan tanpa
  // menyelesaikan materi apa pun.
  const { data: lesson, error: lessonError } = await db
    .from("lessons")
    .select("id, course_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError) {
    console.error("Gagal membaca lesson:", lessonError);
    throw new Error("Gagal memverifikasi pelajaran.");
  }
  if (!lesson) throw new Error("Pelajaran tidak ditemukan.");

  const courseId = lesson.course_id as string;

  if (!(await internIsEnrolled(internProfileId, courseId))) {
    throw new Error("Kamu belum terdaftar di course ini.");
  }

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

  // Hanya lesson yang dipublikasikan yang dihitung: lesson draft tidak bisa
  // dibuka peserta, jadi memasukkannya membuat course mustahil selesai.
  const { data: lessons } = await db
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .neq("is_published", false);

  const lessonIds = (lessons ?? []).map((l) => l.id as string);

  // completed_at wajib terisi. Filter lama hanya mencocokkan keberadaan baris
  // lesson_progress, padahal baris bisa ada dengan completed_at null.
  const { data: completed } = lessonIds.length
    ? await db
        .from("lesson_progress")
        .select("lesson_id")
        .eq("intern_id", internProfileId)
        .not("completed_at", "is", null)
        .in("lesson_id", lessonIds)
    : { data: [] as { lesson_id: string }[] };

  const completedIds = new Set((completed ?? []).map((row) => row.lesson_id as string));

  // lessonIds.length > 0: course tanpa materi tidak pernah "lulus".
  if (lessonIds.length > 0 && lessonIds.every((id) => completedIds.has(id))) {
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

  if (!quizId) throw new Error("Quiz ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta belum ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();

  const { data: quiz, error: quizErr } = await db
    .from("quizzes")
    .select("course_id, questions, is_published")
    .eq("id", quizId)
    .maybeSingle();

  if (quizErr || !quiz) {
    throw new Error("Kuis tidak ditemukan.");
  }

  if (quiz.is_published === false) {
    throw new Error("Kuis belum dipublikasikan.");
  }

  // courseId dari baris kuis, bukan dari formData, dan pendaftaran diverifikasi:
  // sebelumnya siapa pun dengan sesi peserta bisa mengumpulkan kuis course yang
  // tidak diikutinya.
  const courseId = quiz.course_id as string;

  if (!(await internIsEnrolled(internProfileId, courseId))) {
    throw new Error("Kamu belum terdaftar di course ini.");
  }

  // Batas percobaan ditegakkan DI SINI, bukan hanya di UI. `can_attempt_quiz`
  // (`0026_quiz_retry_limit.sql`) sudah ada sejak lama tapi tidak punya satu pun
  // pemanggil di seluruh repo — jadi `max_attempts` dan `retry_delay_minutes`
  // hanya menyembunyikan tombol, dan pemanggilan action ini secara langsung
  // melewatinya sepenuhnya. Kuis adalah dasar penerbitan sertifikat, jadi
  // percobaan tak terbatas berarti nilai kelulusan bisa dicapai dengan mengulang.
  //
  // RPC dipakai apa adanya, bukan dihitung ulang di TypeScript: `0026` sudah
  // memuat aturannya (batas percobaan + jeda antar percobaan), dan menduplikasinya
  // di sini akan membuat dua sumber kebenaran yang bisa menyimpang tanpa suara.
  const { data: gate, error: gateErr } = await db.rpc("can_attempt_quiz", {
    p_user_id: user.id,
    p_quiz_id: quizId,
  });

  // Gagal keras kalau gerbangnya sendiri bermasalah. Kalau RPC-nya error atau
  // tidak mengembalikan baris, keadaan sebenarnya TIDAK diketahui — dan default
  // yang benar untuk gerbang otorisasi yang tidak bisa menjawab adalah menolak,
  // bukan membiarkan lolos.
  if (gateErr) {
    console.error("Gagal memeriksa batas percobaan kuis:", gateErr);
    throw new Error("Batas percobaan kuis tidak dapat diperiksa. Coba lagi.");
  }

  const gateRow = Array.isArray(gate) ? gate[0] : gate;

  if (!gateRow) {
    throw new Error("Batas percobaan kuis tidak dapat diperiksa. Coba lagi.");
  }

  if (gateRow.can_attempt !== true) {
    // `reason` datang dari RPC dan sudah berupa teks yang bisa dibaca; petakan
    // ke pesan Indonesia supaya tidak ada string Inggris bocor ke peserta.
    const alasan =
      gateRow.reason === "Maximum attempts reached"
        ? "Kamu sudah mencapai batas maksimum percobaan untuk kuis ini."
        : gateRow.reason === "Please wait before retrying"
          ? "Belum boleh mencoba lagi. Tunggu jeda antar percobaan selesai."
          : gateRow.reason === "User is not an intern"
            ? "Hanya peserta yang bisa mengumpulkan kuis."
            : "Kamu tidak bisa mengumpulkan kuis ini sekarang.";
    throw new Error(alasan);
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
  await requireStaff();
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
  const content = formData.get("content") as string;
  const file = formData.get("attachment") as File;

  if (!assignmentId) throw new Error("Assignment ID tidak valid.");

  const internProfileId = await getInternProfileId(user.id);
  if (!internProfileId) throw new Error("Profil peserta belum ditemukan.");

  const db = await createUteroAcademyServiceRoleClient();

  // courseId dari baris assignment, bukan dari formData, plus verifikasi
  // pendaftaran. Sebelumnya peserta bisa mengumpulkan tugas course mana pun.
  const { data: assignment, error: assignmentError } = await db
    .from("assignments")
    .select("id, course_id, is_published")
    .eq("id", assignmentId)
    .maybeSingle();

  if (assignmentError) {
    console.error("Gagal membaca assignment:", assignmentError);
    throw new Error("Gagal memverifikasi tugas.");
  }
  if (!assignment) throw new Error("Tugas tidak ditemukan.");
  if (assignment.is_published === false) throw new Error("Tugas belum dipublikasikan.");

  const courseId = assignment.course_id as string;

  if (!(await internIsEnrolled(internProfileId, courseId))) {
    throw new Error("Kamu belum terdaftar di course ini.");
  }

  let attachmentPath: string | null = null;

  if (file && file.size > 0) {
    // Tipe & ekstensi tetap ditentukan dari isi berkas, bukan dari nama/MIME
    // klien. Alasan aslinya (bucket publik → .html/.svg jadi stored XSS) hilang
    // setelah 0032b memprivatkan bucket, tapi validasinya tetap: berkas tetap
    // terlayani lewat signed URL, dan itu sama saja mengeksekusi HTML di origin
    // Storage.
    let submission;
    try {
      submission = await validateUpload(file, ["image", "document"]);
    } catch (error) {
      if (error instanceof UploadValidationError) throw new Error(error.message);
      console.error("Gagal memvalidasi bukti tugas:", error);
      throw new Error("Berkas bukti tugas tidak dapat diproses.");
    }

    const supabase = createSupabaseServiceRoleClient();
    const filePath = buildStoragePath(`assignment/${assignmentId}/${internProfileId}`, submission.ext);

    const { error: uploadError } = await supabase.storage
      .from("learning")
      .upload(filePath, submission.buffer, {
        contentType: submission.contentType,
        upsert: false
      });

    if (uploadError) {
      console.error("Gagal upload assignment attachment:", uploadError);
      throw new Error("Gagal mengunggah file bukti tugas.");
    }

    // Object path, bukan URL publik. Dibaca lewat `resolveStorageUrl("learning", …)`
    // di `features/lms/queries.ts`.
    attachmentPath = filePath;
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
        attachment_path: attachmentPath || undefined,
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
      attachment_path: attachmentPath
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
  const user = await requireStaff();
  const submissionId = formData.get("submissionId") as string;
  const scoreRaw = formData.get("score") as string;
  const feedback = formData.get("feedback") as string;

  if (!submissionId) throw new Error("Submission ID tidak valid.");

  const score = parseFloat(scoreRaw);
  if (isNaN(score) || score < 0 || score > 100) {
    throw new Error("Skor harus antara 0-100.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  // Admin hanya boleh menilai peserta yang dibimbingnya; super_admin bebas.
  const { data: submission, error: submissionError } = await db
    .from("assignment_submissions")
    .select("id, intern_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) {
    console.error("Gagal membaca submission:", submissionError);
    throw new Error("Gagal memverifikasi data tugas.");
  }
  if (!submission) throw new Error("Pengumpulan tugas tidak ditemukan.");

  const scope = await resolveStaffInternScope(user.id);
  if (scope.kind === "setup_required") {
    throw new Error("Profil pembimbing belum disiapkan. Hubungi super admin.");
  }
  if (scope.kind === "scoped" && !scope.internIds.includes(submission.intern_id as string)) {
    throw new Error("Kamu tidak membimbing peserta ini, jadi tidak bisa menilainya.");
  }

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
  await requireStaff();
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
  await requireStaff();
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
  await requireStaff();
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

  // Hanya course terbit boleh didaftar. Tanpa cek ini peserta bisa mendaftar ke
  // course draft (yang tidak muncul di daftar) dan membaca materinya.
  const { data: course, error: courseError } = await db
    .from("courses")
    .select("id, status")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    console.error("Gagal membaca course:", courseError);
    throw new Error("Gagal memverifikasi course.");
  }
  if (!course || course.status !== "published") {
    throw new Error("Course tidak tersedia untuk pendaftaran.");
  }

  const { error } = await db.from("course_enrollments").insert({
    course_id: courseId,
    intern_id: internProfileId
  });

  // 23505 = sudah terdaftar; idempoten, bukan kegagalan.
  if (error && error.code !== "23505") {
    console.error("Gagal enroll course:", error);
    throw new Error("Gagal mendaftar ke course.");
  }

  revalidatePath("/dashboard/intern/lms");
  redirect("/dashboard/intern/lms/" + courseId);
}

export async function createAssignmentAction(formData: FormData) {
  await requireStaff();
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
  await requireStaff();
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
  // Pin komentar adalah moderasi: role, bukan keberadaan mentor_profiles.
  await requireStaff();
  const commentId = formData.get("commentId") as string;
  const courseId = formData.get("courseId") as string;
  const isPinned = formData.get("isPinned") === "true";

  if (!commentId) throw new Error("Comment ID tidak valid.");

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

  // Pemilik komentar, atau staff sebagai moderator. mentor_profiles bukan
  // bukti otorisasi (baris tersebut bisa ada tanpa role staff).
  const isOwner = comment.user_id === user.id;
  if (!isOwner && !(await userIsStaff(user.id))) {
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
  await requireSelfOrStaff(userId);
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
  await requireSelfOrStaff(userId);
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
  await requireUser();
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
  await requireSelfOrStaff(userId);
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
  await requireSelfOrStaff(userId);
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
  // Sesi belajar hanya boleh dicatat untuk diri sendiri.
  await requireSelfOrStaff(userId);
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
  await requireSelfOrStaff(userId);
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
  const user = await requireStaff();
  const db = await createUteroAcademyServiceRoleClient();

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
  await requireSelfOrStaff(userId);
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
  await requireSelfOrStaff(userId);
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db.rpc("can_attempt_quiz", {
    p_user_id: userId,
    p_quiz_id: quizId,
  });

  if (error) throw error;
  return data?.[0] || null;
}

export async function getQuizAttemptsSummary(userId: string, quizId: string) {
  await requireSelfOrStaff(userId);
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
