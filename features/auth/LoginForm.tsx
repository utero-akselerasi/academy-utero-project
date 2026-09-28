"use client";

import { loginAction } from "@/features/auth/actions";
import { LogIn } from "lucide-react";
import { useActionState } from "react";

const initialState = {
  ok: true,
  message: "",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="surface grid gap-4 p-6">
      {/*
        `role="alert"` (temuan #10).

        Pesan galat login muncul setelah form dikirim, di tempat yang fokus
        keyboard TIDAK berada — fokus masih di tombol kirim. Tanpa peran ini
        pengguna pembaca layar tidak diberi tahu apa pun: form tampak sekadar
        tidak terjadi apa-apa, dan tidak ada petunjuk kenapa ia masih berada di
        halaman login.

        Perannya ditaruh pada `<p>` itu sendiri, BUKAN pada pembungkus tetap yang
        selalu dirender. Dua alasan: `role="alert"` memang diumumkan saat
        elemennya disisipkan — itu fungsinya — dan pembungkus kosong di dalam
        `grid gap-4` ini akan menambah satu baris grid beserta jaraknya, jadi
        seluruh form bergeser ke bawah meski tidak ada galat.
      */}
      {!state.ok ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {state.message}
        </p>
      ) : null}

      <label className="form-field">
        <span className="form-label">Email</span>
        <input className="form-input" name="email" placeholder="admin@utero.academy" type="email" required />
      </label>

      <label className="form-field">
        <span className="form-label">Password</span>
        <input className="form-input" name="password" placeholder="Password" type="password" required />
      </label>

      <button className="button-primary" disabled={pending} type="submit">
        <LogIn size={18} />
        {pending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}

