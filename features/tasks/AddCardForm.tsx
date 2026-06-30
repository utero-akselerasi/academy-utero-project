"use client";

import { createCardAction } from "@/features/tasks/actions";
import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";

type Props = {
  listId: string;
  interns: { id: string; full_name: string }[];
};

export function AddCardForm({ listId, interns }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-1.5 flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 bg-slate-200/30 hover:bg-slate-200/60 rounded-md border border-dashed border-slate-300 hover:border-slate-400 font-bold transition-all"
      >
        <Plus size={12} />
        <span>Tambah Tugas</span>
      </button>
    );
  }

  return (
    <form 
      action={async (formData) => {
        try {
          await createCardAction(formData);
          setIsOpen(false);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Gagal menambah tugas.");
        }
      }}
      className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm grid gap-2"
    >
      <input name="listId" type="hidden" value={listId} />
      
      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
        <span className="text-[10px] font-black text-slate-400 uppercase">Tugas Baru</span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
        >
          <X size={12} />
        </button>
      </div>

      <input 
        className="form-input text-xs py-1 px-2 h-7 bg-slate-50 focus:bg-white" 
        name="title" 
        placeholder="Judul tugas..." 
        required 
        autoFocus 
      />
      
      <textarea 
        className="form-input text-xs py-1 px-2 bg-slate-50 focus:bg-white" 
        name="description" 
        placeholder="Deskripsi (opsional)..." 
        rows={2} 
      />
      
      <div className="grid grid-cols-2 gap-1.5">
        <select className="form-input text-[10px] py-1 px-1.5 h-7 bg-slate-50" name="internId">
          <option value="">Assignee...</option>
          {interns.map((intern) => (
            <option key={intern.id} value={intern.id}>
              {intern.full_name}
            </option>
          ))}
        </select>
        <input className="form-input text-[10px] py-1 px-1.5 h-7 bg-slate-50" name="dueAt" type="date" />
      </div>

      <button className="button-primary text-[10px] py-1.5 min-h-0 w-full font-bold" type="submit">
        Simpan Tugas
      </button>
    </form>
  );
}
