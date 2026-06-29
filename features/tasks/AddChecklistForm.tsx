"use client";

import { addChecklistAction } from "@/features/tasks/actions";

type Props = {
  cardId: string;
};

export function AddChecklistForm({ cardId }: Props) {
  return (
    <form action={addChecklistAction} className="mt-2 flex gap-2">
      <input name="cardId" type="hidden" value={cardId} />
      <input className="form-input text-xs" name="title" placeholder="Item checklist..." required />
      <button className="button-secondary whitespace-nowrap text-xs" type="submit">+</button>
    </form>
  );
}
