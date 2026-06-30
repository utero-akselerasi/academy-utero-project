"use server";

import { createSupabaseServerClient, createUteroAcademyClient, createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createBoardSchema,
  createListSchema,
  createCardSchema,
  addChecklistSchema,
  toggleChecklistSchema,
  addSubtaskSchema,
  toggleSubtaskSchema,
  updatePrioritySchema,
} from "./schemas";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export type FormState = {
  ok: boolean;
  message: string;
};

export async function createBoardAction(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = createBoardSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("task_boards").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
    owner_id: user.id,
  });

  if (error) {
    console.error("Gagal buat board:", error);
    return { ok: false, message: "Board belum berhasil dibuat." };
  }

  revalidatePath("/dashboard/mentor/tasks");
  return { ok: true, message: "Board berhasil dibuat." };
}

export async function createListAction(formData: FormData) {
  await requireUser();

  const parsed = createListSchema.safeParse({
    boardId: formData.get("boardId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    throw new Error("Data list tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { data: maxOrder } = await db
    .from("task_lists")
    .select("order_index")
    .eq("board_id", parsed.data.boardId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("task_lists").insert({
    board_id: parsed.data.boardId,
    name: parsed.data.name,
    order_index: nextOrder,
  });

  if (error) {
    console.error("Gagal buat list:", error);
    throw new Error("List belum berhasil dibuat.");
  }

  revalidatePath("/dashboard/mentor/tasks");
}

export async function createCardAction(formData: FormData) {
  const user = await requireUser();

  const parsed = createCardSchema.safeParse({
    listId: formData.get("listId"),
    title: formData.get("title"),
    description: formData.get("description"),
    internId: formData.get("internId") || undefined,
    dueAt: formData.get("dueAt") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Data card tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { data: maxOrder } = await db
    .from("task_cards")
    .select("order_index")
    .eq("list_id", parsed.data.listId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("task_cards").insert({
    list_id: parsed.data.listId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    intern_id: parsed.data.internId || null,
    due_at: parsed.data.dueAt || null,
    order_index: nextOrder,
    created_by: user.id,
  });

  if (error) {
    console.error("Gagal buat card:", error);
    throw new Error("Task belum berhasil dibuat.");
  }

  revalidatePath("/dashboard/mentor/tasks");
}

export async function addChecklistAction(formData: FormData) {
  await requireUser();

  const parsed = addChecklistSchema.safeParse({
    cardId: formData.get("cardId"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    throw new Error("Data checklist tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { data: maxOrder } = await db
    .from("task_checklists")
    .select("order_index")
    .eq("card_id", parsed.data.cardId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("task_checklists").insert({
    card_id: parsed.data.cardId,
    title: parsed.data.title,
    order_index: nextOrder,
  });

  if (error) {
    console.error("Gagal tambah checklist:", error);
    throw new Error("Checklist belum berhasil ditambahkan.");
  }

  revalidatePath("/dashboard/mentor/tasks");
  revalidatePath("/dashboard/intern/tasks");
}

export async function toggleChecklistAction(formData: FormData) {
  await requireUser();

  const parsed = toggleChecklistSchema.safeParse({
    checklistId: formData.get("checklistId"),
    isDone: formData.get("isDone"),
  });

  if (!parsed.success) {
    throw new Error("Data checklist tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db
    .from("task_checklists")
    .update({
      is_done: parsed.data.isDone === "true",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.checklistId);

  if (error) {
    console.error("Gagal toggle checklist:", error);
    throw new Error("Checklist belum berhasil diperbarui.");
  }

  revalidatePath("/dashboard/mentor/tasks");
  revalidatePath("/dashboard/intern/tasks");
}

export async function addTaskAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const cardId = formData.get("cardId") as string;
  const file = formData.get("attachment") as File;

  if (!cardId || !file || file.size === 0) {
    throw new Error("File attachment wajib diunggah.");
  }

  const supabase = createSupabaseServiceRoleClient(); // Gunakan service role untuk storage upload
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${cardId}/${Date.now()}.${ext}`;
  
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("task")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true
    });

  if (uploadError) {
    console.error("Gagal upload attachment:", uploadError);
    throw new Error("Gagal mengunggah file lampiran.");
  }

  // Get public URL or media link
  const { data: { publicUrl } } = supabase.storage.from("task").getPublicUrl(filePath);

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("task_attachments").insert({
    card_id: cardId,
    uploaded_by: user.id,
    file_path: publicUrl,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size
  });

  if (error) {
    console.error("Gagal simpan attachment DB:", error);
    throw new Error("Gagal menyimpan data lampiran.");
  }

  revalidatePath("/dashboard/mentor/tasks");
  revalidatePath("/dashboard/intern/tasks");
}

export async function deleteBoardAction(formData: FormData) {
  const user = await requireUser();
  const boardId = formData.get("boardId") as string;
  if (!boardId) throw new Error("Board ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  
  // Hapus board jika dimiliki oleh user login
  const { error } = await db
    .from("task_boards")
    .delete()
    .eq("id", boardId)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Gagal menghapus board:", error);
    throw new Error("Gagal menghapus board.");
  }

  revalidatePath("/dashboard/mentor/tasks");
}

export async function deleteCardAction(formData: FormData) {
  await requireUser();
  const cardId = formData.get("cardId") as string;
  const boardId = formData.get("boardId") as string;
  if (!cardId) throw new Error("Card ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("task_cards").delete().eq("id", cardId);

  if (error) {
    console.error("Gagal menghapus card:", error);
    throw new Error("Gagal menghapus task.");
  }

  if (boardId) {
    revalidatePath("/dashboard/mentor/tasks/" + boardId);
    revalidatePath("/dashboard/intern/tasks");
  } else {
    revalidatePath("/dashboard/mentor/tasks");
    revalidatePath("/dashboard/intern/tasks");
  }
}

export async function assignCardToInternAction(formData: FormData) {
  await requireUser();
  const cardId = formData.get("cardId") as string;
  const internId = formData.get("internId") as string;
  const boardId = formData.get("boardId") as string;
  
  if (!cardId) throw new Error("Card ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db
    .from("task_cards")
    .update({
      intern_id: internId || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", cardId);

  if (error) {
    console.error("Gagal assign card:", error);
    throw new Error("Gagal menetapkan peserta magang.");
  }

  revalidatePath("/dashboard/mentor/tasks/" + boardId);
  revalidatePath("/dashboard/intern/tasks");
}

export async function deleteListAction(formData: FormData) {
  await requireUser();
  const listId = formData.get("listId") as string;
  const boardId = formData.get("boardId") as string;
  if (!listId) throw new Error("List ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("task_lists").delete().eq("id", listId);

  if (error) {
    console.error("Gagal menghapus list:", error);
    throw new Error("Gagal menghapus list.");
  }

  revalidatePath("/dashboard/mentor/tasks/" + boardId);
}

export async function deleteChecklistItemAction(formData: FormData) {
  await requireUser();
  const checklistId = formData.get("checklistId") as string;
  const boardId = formData.get("boardId") as string;
  if (!checklistId) throw new Error("Checklist ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("task_checklists").delete().eq("id", checklistId);

  if (error) {
    console.error("Gagal menghapus checklist item:", error);
    throw new Error("Gagal menghapus checklist item.");
  }

  if (boardId) {
    revalidatePath("/dashboard/mentor/tasks/" + boardId);
  } else {
    revalidatePath("/dashboard/mentor/tasks");
  }
  revalidatePath("/dashboard/intern/tasks");
}

export async function createSubtaskAction(formData: FormData) {
  await requireUser();

  const parsed = addSubtaskSchema.safeParse({
    cardId: formData.get("cardId"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    throw new Error("Data subtask tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { data: maxOrder } = await db
    .from("task_subtasks")
    .select("order_index")
    .eq("card_id", parsed.data.cardId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("task_subtasks").insert({
    card_id: parsed.data.cardId,
    title: parsed.data.title,
    order_index: nextOrder,
    is_done: false
  });

  if (error) {
    console.error("Gagal tambah subtask:", error);
    throw new Error("Gagal menambahkan sub-task.");
  }

  revalidatePath("/dashboard/mentor/tasks");
  revalidatePath("/dashboard/intern/tasks");
}

export async function toggleSubtaskAction(formData: FormData) {
  await requireUser();

  const parsed = toggleSubtaskSchema.safeParse({
    subtaskId: formData.get("subtaskId"),
    isDone: formData.get("isDone"),
  });

  if (!parsed.success) {
    throw new Error("Data subtask tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db
    .from("task_subtasks")
    .update({
      is_done: parsed.data.isDone === "true",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.subtaskId);

  if (error) {
    console.error("Gagal toggle subtask:", error);
    throw new Error("Gagal memperbarui status sub-task.");
  }

  revalidatePath("/dashboard/mentor/tasks");
  revalidatePath("/dashboard/intern/tasks");
}

export async function deleteSubtaskAction(formData: FormData) {
  await requireUser();
  const subtaskId = formData.get("subtaskId") as string;
  if (!subtaskId) throw new Error("Subtask ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("task_subtasks").delete().eq("id", subtaskId);

  if (error) {
    console.error("Gagal menghapus subtask:", error);
    throw new Error("Gagal menghapus sub-task.");
  }

  revalidatePath("/dashboard/mentor/tasks");
  revalidatePath("/dashboard/intern/tasks");
}

export async function updateCardPriorityAction(formData: FormData) {
  await requireUser();

  const parsed = updatePrioritySchema.safeParse({
    cardId: formData.get("cardId"),
    priority: formData.get("priority"),
  });

  if (!parsed.success) {
    throw new Error("Data prioritas tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db
    .from("task_cards")
    .update({
      priority: parsed.data.priority,
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data.cardId);

  if (error) {
    console.error("Gagal update prioritas:", error);
    throw new Error("Gagal memperbarui prioritas tugas.");
  }

  revalidatePath("/dashboard/mentor/tasks");
  revalidatePath("/dashboard/intern/tasks");
}
