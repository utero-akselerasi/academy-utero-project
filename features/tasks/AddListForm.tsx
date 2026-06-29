"use client";

import { createListAction } from "@/features/tasks/actions";

type Props = {
  boardId: string;
};

export function AddListForm({ boardId }: Props) {
  return (
    <form action={createListAction} className="flex gap-2">
      <input name="boardId" type="hidden" value={boardId} />
      <input className="form-input" name="name" placeholder="Nama list baru..." required />
      <button className="button-primary whitespace-nowrap text-sm" type="submit">
        + List
      </button>
    </form>
  );
}
