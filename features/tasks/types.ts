export type TaskBoard = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskList = {
  id: string;
  board_id: string;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type TaskCard = {
  id: string;
  list_id: string;
  intern_id: string | null;
  mentor_id: string | null;
  title: string;
  description: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  due_at: string | null;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskChecklist = {
  id: string;
  card_id: string;
  title: string;
  is_done: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type TaskSubtask = {
  id: string;
  card_id: string;
  title: string;
  is_done: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type TaskAttachment = {
  id: string;
  card_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type TaskCardWithDetails = TaskCard & {
  task_checklists: TaskChecklist[];
  task_attachments: TaskAttachment[];
  task_subtasks: TaskSubtask[];
};

export type TaskComment = {
  id: string;
  card_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

export type TaskListWithCards = TaskList & {
  task_cards: TaskCardWithDetails[];
};

export type TaskBoardWithLists = TaskBoard & {
  task_lists: TaskListWithCards[];
};
