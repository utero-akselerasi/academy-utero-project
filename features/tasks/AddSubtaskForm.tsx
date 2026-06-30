"use client";

import { createSubtaskAction } from "@/features/tasks/actions";
import { Plus } from "lucide-react";
import { useState } from "react";

type Props = {
  cardId: string;
};

export function AddSubtaskForm({ cardId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-[10px] text-teal-700 font-bold hover:underline flex items-center gap-0.5 mt-1"
      >
        <Plus size={11} />
        <span>Add Sub-task</span>
      </button>
    );
  }

  return (
    <form 
      action={async (formData) => {
        try {
          await createSubtaskAction(formData);
          setIsOpen(false);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Gagal menambah sub-task.");
        }
      }}
      className="mt-2 flex gap-1 items-center"
    >
      <input name="cardId" type="hidden" value={cardId} />
      <input
        className="form-input text-xs py-1 px-2 h-7 flex-1 bg-white"
        name="title"
        placeholder="Nama sub-task..."
        required
        autoFocus
      />
      <button type="submit" className="button-primary text-[10px] h-7 py-0 px-2 min-h-0 flex items-center justify-center shrink-0">
        Add
      </button>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="button-secondary text-[10px] h-7 py-0 px-2 min-h-0 flex items-center justify-center shrink-0"
      >
        Batal
      </button>
    </form>
  );
}
