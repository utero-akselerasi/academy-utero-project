"use client";

import { toggleChecklistAction, deleteChecklistItemAction } from "@/features/tasks/actions";
import { type TaskChecklist } from "@/features/tasks/types";
import { Trash2 } from "lucide-react";
import { usePathname } from "next/navigation";

type Props = {
  item: TaskChecklist;
};

export function ChecklistItem({ item }: Props) {
  const pathname = usePathname();
  const segments = pathname.split("/");
  const boardId = segments[segments.length - 1] !== "tasks" && segments.includes("mentor") 
    ? segments[segments.length - 1] 
    : "";

  return (
    <div className="flex items-center justify-between gap-3 group/item hover:bg-slate-100/50 p-1 rounded transition-all">
      <form action={toggleChecklistAction} className="flex-1 min-w-0">
        <input name="checklistId" type="hidden" value={item.id} />
        <input name="isDone" type="hidden" value={item.is_done ? "false" : "true"} />
        <button
          className={`flex items-center gap-2 text-sm text-left w-full ${
            item.is_done ? "text-slate-400 line-through" : "text-slate-700 font-medium"
          }`}
          type="submit"
        >
          <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
            item.is_done ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 bg-white hover:border-teal-500"
          }`}>
            {item.is_done ? "?" : ""}
          </span>
          <span className="truncate">{item.title}</span>
        </button>
      </form>

      <form action={deleteChecklistItemAction} className="shrink-0 flex items-center">
        <input name="checklistId" type="hidden" value={item.id} />
        <input name="boardId" type="hidden" value={boardId} />
        <button
          type="submit"
          className="text-slate-400 hover:text-red-700 p-1 rounded transition-colors flex items-center justify-center"
          title="Hapus item checklist"
          onClick={(e) => {
            if (!confirm("Apakah Anda yakin ingin menghapus item checklist ini?")) {
              e.preventDefault();
            }
          }}
        >
          <Trash2 size={13} />
        </button>
      </form>
    </div>
  );
}
