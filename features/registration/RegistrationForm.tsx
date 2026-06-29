"use client";

import {
  type RegistrationState,
  submitRegistrationAction,
} from "@/features/registration/actions";
import { Send } from "lucide-react";
import { useActionState } from "react";

const initialState: RegistrationState = {
  ok: false,
  message: "",
};

export function RegistrationForm() {
  const [state, formAction, pending] = useActionState(
    submitRegistrationAction,
    initialState,
  );

  return (
    <form action={formAction} className="surface grid gap-5 p-6">
      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          }>
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-field">
          <span className="form-label">Nama lengkap</span>
          <input
            className="form-input"
            name="fullName"
            placeholder="Nama peserta"
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Email</span>
          <input
            className="form-input"
            name="email"
            placeholder="nama@email.com"
            type="email"
            required
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="form-field">
          <span className="form-label">Nomor WhatsApp</span>
          <input
            className="form-input"
            name="phone"
            placeholder="08xxxxxxxxxx"
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Sekolah atau kampus</span>
          <input
            className="form-input"
            name="schoolName"
            placeholder="Nama sekolah"
            required
          />
        </label>
      </div>

      <label className="form-field">
        <span className="form-label">Jurusan</span>
        <input
          className="form-input"
          name="major"
          placeholder="Contoh: RPL, DKV, Manajemen"
          required
        />
      </label>

      <label className="form-field">
        <span className="form-label">Motivasi mengikuti magang</span>
        <textarea
          className="form-input min-h-32 resize-y"
          name="motivation"
          placeholder="Ceritakan alasan dan tujuan mengikuti program magang."
          required
        />
      </label>

      <button className="button-primary" disabled={pending} type="submit">
        <Send size={18} />
        {pending ? "Mengirim..." : "Kirim pendaftaran"}
      </button>
    </form>
  );
}
