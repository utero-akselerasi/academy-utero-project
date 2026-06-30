"use client";

import { createListAction } from "@/features/tasks/actions";
import { Plus } from "lucide-react";

type Props = {
  boardId: string;
};

export function AddListForm({ boardId }: Props) {
  return (
    <form action={createListAction} className="flex gap-1.5 items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm max-w-xs">
      <input name="boardId" type="hidden" value={boardId} />
      <input 
        className="form-input text-xs py-1 px-2.5 h-8 border-0 bg-transparent focus:ring-0 focus:outline-none flex-1 min-w-0" 
        name="name" 
        placeholder="Nama list baru..." 
        required 
      />
      <button 
        className="button-primary text-xs h-8 py-0 px-3 min-h-0 flex items-center gap-1 font-bold shrink-0 whitespace-nowrap" 
        type="submit"
      >
        <Plus size={13} />
        <span>List</span>
      </button>
    </form>
  );
}
