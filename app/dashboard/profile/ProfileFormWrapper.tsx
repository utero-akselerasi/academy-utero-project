"use client";

import { updateProfileAction, type ProfileFormState } from "@/features/auth/edit-profile-action";
import { useActionState } from "react";
import { Save } from "lucide-react";

const initialState = { ok: false, message: "" };

export function ProfileFormWrapper({ userProfile, internProfile, mentorProfile }: { userProfile: any; internProfile: any; mentorProfile: any }) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);
  return (
    <form action={formAction} className="surface p-6 bg-white grid gap-6">
      <div>
        <h3 className="font-bold text-slate-950 border-b border-slate-200 pb-2 mb-4">Informasi Utama</h3>
        <div className="grid gap-4">
          <div className="form-field">
            <label className="form-label" htmlFor="fullName">Nama Lengkap *</label>
            <input className="form-input" id="fullName" name="fullName" defaultValue={userProfile?.full_name || ""} required />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="phone">Nomor WhatsApp/Telepon</label>
            <input className="form-input" id="phone" name="phone" defaultValue={userProfile?.phone || ""} />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="avatar">Foto Profil</label>
            <input className="form-input text-sm" id="avatar" name="avatar" type="file" accept="image/*" />
          </div>
        </div>
      </div>
      {internProfile && (
        <div>
          <h3 className="font-bold text-slate-950 border-b border-slate-200 pb-2 mb-4">Detail Akademik / Magang</h3>
          <div className="grid gap-4">
            <div className="form-field">
              <label className="form-label" htmlFor="major">Jurusan</label>
              <input className="form-input" id="major" name="major" defaultValue={internProfile?.major || ""} placeholder="Contoh: Rekayasa Perangkat Lunak" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="gradeOrSemester">Kelas / Semester / Tingkat</label>
              <input className="form-input" id="gradeOrSemester" name="gradeOrSemester" defaultValue={internProfile?.grade_or_semester || ""} placeholder="Contoh: XII, Semester 5" />
            </div>
          </div>
        </div>
      )}
      {mentorProfile && (
        <div>
          <h3 className="font-bold text-slate-950 border-b border-slate-200 pb-2 mb-4">Profil Mentor</h3>
          <div className="grid gap-4">
            <div className="form-field">
              <label className="form-label" htmlFor="headline">Headline Profesional</label>
              <input className="form-input" id="headline" name="headline" defaultValue={mentorProfile?.headline || ""} placeholder="Contoh: Senior UI/UX Designer di Utero" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="bio">Bio Singkat</label>
              <textarea className="form-input" id="bio" name="bio" defaultValue={mentorProfile?.bio || ""} rows={3} placeholder="Ceritakan keahlian dan peran bimbingan Anda..." />
            </div>
          </div>
        </div>
      )}
      {state.message && (
        <p className={"text-sm font-semibold " + (state.ok ? "text-teal-700" : "text-red-700")}>
          {state.message}
        </p>
      )}
      <button className="button-primary w-full flex items-center justify-center gap-2" disabled={isPending} type="submit">
        <Save size={18} />
        {isPending ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
    </form>
  );
}
