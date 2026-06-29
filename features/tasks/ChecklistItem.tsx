"use client";

import { toggleChecklistAction } from "@/features/tasks/actions";
import { type TaskChecklist } from "@/features/tasks/types";

type Props = {
  item: TaskChecklist;
};

export function ChecklistItem({ item }: Props) {
  return (
    <form action={toggleChecklistAction} className="flex items-center gap-2">
      <input name="checklistId" type="hidden" value={item.id} />
      <input name="isDone" type="hidden" value={item.is_done ? "false" : "true"} />
      <button
        className={`flex items-center gap-2 text-sm ${item.is_done ? "text-slate-400 line-through" : "text-slate-700"}`}
        type="submit"
      >
        <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${item.is_done ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300"}`}>
          {item.is_done ? "✓" : ""}
        </span>
        {item.title}
      </button>
    </form>
  );
}
