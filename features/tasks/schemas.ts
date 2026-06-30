import { z } from "zod";

export const createBoardSchema = z.object({
  name: z.string().min(2, "Nama board minimal 2 karakter."),
  description: z.string().optional(),
});

export const createListSchema = z.object({
  boardId: z.string().uuid("Board ID tidak valid."),
  name: z.string().min(1, "Nama list wajib diisi."),
});

export const createCardSchema = z.object({
  listId: z.string().uuid("List ID tidak valid."),
  title: z.string().min(2, "Judul task minimal 2 karakter."),
  description: z.string().optional(),
  internId: z.string().uuid("Intern ID tidak valid.").optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  dueAt: z.string().optional(),
});

export const addChecklistSchema = z.object({
  cardId: z.string().uuid("Card ID tidak valid."),
  title: z.string().min(1, "Item checklist wajib diisi."),
});

export const toggleChecklistSchema = z.object({
  checklistId: z.string().uuid("Checklist ID tidak valid."),
  isDone: z.enum(["true", "false"]),
});

export const addSubtaskSchema = z.object({
  cardId: z.string().uuid("Card ID tidak valid."),
  title: z.string().min(1, "Judul sub-task wajib diisi."),
});

export const toggleSubtaskSchema = z.object({
  subtaskId: z.string().uuid("Subtask ID tidak valid."),
  isDone: z.enum(["true", "false"]),
});

export const updatePrioritySchema = z.object({
  cardId: z.string().uuid("Card ID tidak valid."),
  priority: z.enum(["urgent", "high", "medium", "low"]),
});
