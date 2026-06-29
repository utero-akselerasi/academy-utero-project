import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { type TaskBoard, type TaskBoardWithLists, type TaskCardWithDetails } from "./types";

export async function getMentorBoards(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("task_boards")
    .select("id, name, description, owner_id, created_at, updated_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .returns<TaskBoard[]>();

  return { data: data ?? [], error };
}

export async function getBoardWithLists(boardId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("task_boards")
    .select("id, name, description, owner_id, created_at, updated_at, task_lists(id, board_id, name, order_index, created_at, updated_at, task_cards(id, list_id, intern_id, mentor_id, title, description, due_at, order_index, created_by, created_at, updated_at, task_checklists(id, card_id, title, is_done, order_index, created_at, updated_at), task_attachments(id, card_id, uploaded_by, file_path, file_name, mime_type, size_bytes, created_at)))")
    .eq("id", boardId)
    .order("order_index", { referencedTable: "task_lists", ascending: true })
    .order("order_index", { referencedTable: "task_lists.task_cards", ascending: true })
    .order("order_index", { referencedTable: "task_lists.task_cards.task_checklists", ascending: true })
    .order("created_at", { referencedTable: "task_lists.task_cards.task_attachments", ascending: false })
    .maybeSingle()
    .returns<TaskBoardWithLists>();

  return { data, error };
}

export async function getInternCards(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("task_cards")
    .select("id, list_id, intern_id, mentor_id, title, description, due_at, order_index, created_by, created_at, updated_at, task_checklists(id, card_id, title, is_done, order_index, created_at, updated_at), task_attachments(id, card_id, uploaded_by, file_path, file_name, mime_type, size_bytes, created_at)")
    .eq("intern_id", internProfileId)
    .order("created_at", { ascending: false })
    .order("order_index", { referencedTable: "task_checklists", ascending: true })
    .order("created_at", { referencedTable: "task_attachments", ascending: false })
    .returns<TaskCardWithDetails[]>();

  return { data: data ?? [], error };
}
