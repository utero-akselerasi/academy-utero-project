import { resolveStorageUrls } from "@/lib/storage-urls";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { type TaskAttachment, type TaskBoard, type TaskBoardWithLists, type TaskCardWithDetails } from "./types";

/**
 * Menandatangani `file_path` setiap lampiran task.
 *
 * Ditaruh di lapisan query karena dua bentuk kueri membaca lampiran yang sama
 * dengan sarang berbeda: `getInternCards` mengembalikan kartu datar, sedangkan
 * `getBoardWithLists` menyarangkannya tiga tingkat
 * (`task_lists` → `task_cards` → `task_attachments`). Menandatangani di halaman
 * berarti menulis dua kali penelusuran sarang yang berbeda.
 *
 * Ditandatangani per kartu secara paralel lewat `resolveStorageUrls`; satu kartu
 * bisa punya banyak lampiran dan berurutan akan menaikkan latensi papan
 * sebanding jumlah seluruh lampiran di papan itu.
 */
async function signCardAttachments(attachments: TaskAttachment[] | null | undefined) {
  if (!attachments || attachments.length === 0) return [];

  const urls = await resolveStorageUrls("task", attachments.map((att) => att.file_path));
  return attachments.map((att, index) => ({ ...att, file_path: urls[index] }));
}

export async function getMentorBoards(userId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data: boards, error } = await db
    .from("task_boards")
    .select("id, name, description, owner_id, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error || !boards) {
    return { data: [], error };
  }

  const { data: userProfiles } = await db
    .from("user_profiles")
    .select("id, full_name");

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach(p => profilesMap.set(p.id, p));
  }

  const mapped = boards.map(b => {
    const ownerProfile = b.owner_id ? profilesMap.get(b.owner_id) : null;
    return {
      ...b,
      owner_name: ownerProfile?.full_name || "Admin"
    };
  });

  return { data: mapped, error: null };
}

export async function getBoardWithLists(boardId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("task_boards")
    .select("id, name, description, owner_id, created_at, updated_at, task_lists(id, board_id, name, order_index, created_at, updated_at, task_cards(id, list_id, intern_id, mentor_id, title, description, priority, due_at, order_index, created_by, created_at, updated_at, task_checklists(id, card_id, title, is_done, order_index, created_at, updated_at), task_subtasks(id, card_id, title, is_done, order_index, created_at, updated_at), task_attachments(id, card_id, uploaded_by, file_path, file_name, mime_type, size_bytes, created_at))))")
    .eq("id", boardId)
    .order("order_index", { referencedTable: "task_lists", ascending: true })
    .order("order_index", { referencedTable: "task_lists.task_cards", ascending: true })
    .order("order_index", { referencedTable: "task_lists.task_cards.task_checklists", ascending: true })
    .order("created_at", { referencedTable: "task_lists.task_cards.task_attachments", ascending: false })
    .maybeSingle()
    .returns<TaskBoardWithLists>();

  if (error || !data) {
    return { data, error };
  }

  // Sarang tiga tingkat: papan → list → kartu → lampiran.
  const signed: TaskBoardWithLists = {
    ...data,
    task_lists: await Promise.all(
      (data.task_lists ?? []).map(async (list) => ({
        ...list,
        task_cards: await Promise.all(
          (list.task_cards ?? []).map(async (card) => ({
            ...card,
            task_attachments: await signCardAttachments(card.task_attachments),
          })),
        ),
      })),
    ),
  };

  return { data: signed, error };
}

export async function getInternCards(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("task_cards")
    .select("id, list_id, intern_id, mentor_id, title, description, priority, due_at, order_index, created_by, created_at, updated_at, task_checklists(id, card_id, title, is_done, order_index, created_at, updated_at), task_subtasks(id, card_id, title, is_done, order_index, created_at, updated_at), task_attachments(id, card_id, uploaded_by, file_path, file_name, mime_type, size_bytes, created_at)")
    .eq("intern_id", internProfileId)
    .order("created_at", { ascending: false })
    .order("order_index", { referencedTable: "task_checklists", ascending: true })
    .order("created_at", { referencedTable: "task_attachments", ascending: false })
    .returns<TaskCardWithDetails[]>();

  if (error || !data) {
    return { data: [], error };
  }

  const signed = await Promise.all(
    data.map(async (card) => ({
      ...card,
      task_attachments: await signCardAttachments(card.task_attachments),
    })),
  );

  return { data: signed, error };
}
