"use client";

import { createCardAction } from "@/features/tasks/actions";

type Props = {
  listId: string;
  interns: { id: string; full_name: string }[];
};

export function AddCardForm({ listId, interns }: Props) {
  return (
    <form action={createCardAction} className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
      <input name="listId" type="hidden" value={listId} />
      <input className="form-input text-sm" name="title" placeholder="Judul task..." required />
      <textarea className="form-input text-sm" name="description" placeholder="Deskripsi (opsional)..." rows={2} />
      
      <select className="form-input text-sm" name="internId">
        <option value="">Ditugaskan ke siapa? (opsional)</option>
        {interns.map((intern) => (
          <option key={intern.id} value={intern.id}>
            {intern.full_name}
          </option>
        ))}
      </select>

      <input className="form-input text-sm" name="dueAt" placeholder="Deadline" type="date" />
      <button className="button-primary text-sm" type="submit">
        + Task
      </button>
    </form>
  );
}
