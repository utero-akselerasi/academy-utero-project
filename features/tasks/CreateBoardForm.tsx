"use client";

import { createBoardAction, type FormState } from "@/features/tasks/actions";
import { useActionState } from "react";

const initialState: FormState = { ok: false, message: "" };

export function CreateBoardForm() {
  const [state, formAction, isPending] = useActionState(createBoardAction, initialState);

  return (
    <form action={formAction} className="surface grid gap-4 p-5">
      <h3 className="font-bold text-slate-950">Buat Board Baru</h3>

      <div className="form-field">
        <label className="form-label" htmlFor="boardName">Nama Board</label>
        <input className="form-input" id="boardName" name="name" placeholder="Contoh: Sprint 1" required />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="boardDesc">Deskripsi</label>
        <input className="form-input" id="boardDesc" name="description" placeholder="Opsional..." />
      </div>

      {state.message ? (
        <p className={`text-sm font-semibold ${state.ok ? "text-teal-700" : "text-red-700"}`}>
          {state.message}
        </p>
      ) : null}

      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "Membuat..." : "Buat Board"}
      </button>
    </form>
  );
}
