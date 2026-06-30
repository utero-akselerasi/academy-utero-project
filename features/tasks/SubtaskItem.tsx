"use client";

import { toggleSubtaskAction, deleteSubtaskAction } from "@/features/tasks/actions";
import { type TaskSubtask } from "@/features/tasks/types";
import { Trash2 } from "lucide-react";

type Props = {
  item: TaskSubtask;
};

export function SubtaskItem({ item }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 group/subitem hover:bg-slate-100/50 p-1 rounded transition-all">
      <form action={toggleSubtaskAction} className="flex-1 min-w-0">
        <input name="subtaskId" type="hidden" value={item.id} />
        <input name="isDone" type="hidden" value={item.is_done ? "false" : "true"} />
        <button
          className={`flex items-center gap-2 text-xs text-left w-full ${
            item.is_done ? "text-slate-400 line-through" : "text-slate-600 font-medium"
          }`}
          type="submit"
        >
          <span className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-all ${
            item.is_done ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 bg-white hover:border-teal-500"
          }`}>
            {item.is_done ? "?" : ""}
          </span>
          <span className="truncate">{item.title}</span>
        </button>
      </form>

      <form action={deleteSubtaskAction} className="shrink-0 flex items-center">
        <input name="subtaskId" type="hidden" value={item.id} />
        <button
          type="submit"
          className="text-red-500 hover:text-red-700 p-0.5 rounded opacity-0 group-hover/subitem:opacity-100 transition-opacity flex items-center justify-center"
          title="Hapus sub-task"
          onClick={(e) => {
            if (!confirm("Apakah Anda yakin ingin menghapus sub-task ini?")) {
              e.preventDefault();
            }
          }}
        >
          <Trash2 size={12} />
        </button>
      </form>
    </div>
  );
}
