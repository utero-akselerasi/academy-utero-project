// Tambahkan ke bagian akhir file actions.ts

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

  // Cek apakah user adalah mentor/admin
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

  // Cek ownership atau role mentor/admin
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
