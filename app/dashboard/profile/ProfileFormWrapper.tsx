"use client";

import { updateProfileAction, type ProfileFormState } from "@/features/auth/edit-profile-action";
import { changePasswordAction } from "@/features/auth/change-password-action";
import { useActionState, useState } from "react";
import { Save, Lock } from "lucide-react";
import type { InternProfileData } from "@/features/auth/profile-schema";

const initialState = { ok: false, message: "" };

type UserProfile = { full_name: string; phone: string | null } | null;
type MentorProfile = { headline: string | null; bio: string | null } | null;

export function ProfileFormWrapper({ userProfile, internProfile, mentorProfile, email }: {
  userProfile: UserProfile; internProfile: InternProfileData | null; mentorProfile: MentorProfile; email: string;
}) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="surface p-6 bg-white grid gap-6">
        <div>
          <h3 className="font-bold text-slate-950 border-b border-slate-200 pb-2 mb-4">Informasi Utama</h3>
          <div className="grid gap-4">
            <div className="form-field">
              <label className="form-label" htmlFor="fullName">Nama Lengkap *</label>
              <input className="form-input" id="fullName" name="fullName" defaultValue={userProfile?.full_name || ""} maxLength={150} required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="email">Email Akun</label>
              <input className="form-input" id="email" type="email" value={email} readOnly />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="phone">Nomor WhatsApp/Telepon</label>
              <input className="form-input" id="phone" name="phone" type="tel" defaultValue={userProfile?.phone || ""} maxLength={25} required={Boolean(internProfile)} />
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
                <input className="form-input" id="major" name="major" defaultValue={internProfile.major || ""} maxLength={120} required placeholder="Contoh: Rekayasa Perangkat Lunak" />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="gradeOrSemester">Kelas / Semester / Tingkat</label>
                <input className="form-input" id="gradeOrSemester" name="gradeOrSemester" defaultValue={internProfile.grade_or_semester || ""} maxLength={60} required placeholder="Contoh: XII, Semester 5" />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="schoolName">Sekolah / Kampus *</label>
                <input className="form-input" id="schoolName" name="schoolName" defaultValue={internProfile.school_name || internProfile.schools?.name || ""} maxLength={150} required />
                <p className="text-xs text-slate-500">Instansi terhubung: {internProfile.schools?.name || "Belum ditetapkan admin"}. Pengisian nama tidak mengubah instansi resmi.</p>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="address">Alamat Lengkap *</label>
                <textarea className="form-input" id="address" name="address" defaultValue={internProfile.address || ""} maxLength={500} required rows={3} />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="schoolSupervisorName">Guru / Dosen Pembimbing Sekolah *</label>
                <input className="form-input" id="schoolSupervisorName" name="schoolSupervisorName" defaultValue={internProfile.school_supervisor_name || ""} maxLength={150} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="schoolSupervisorPhone">Nomor Pembimbing Sekolah *</label>
                <input className="form-input" id="schoolSupervisorPhone" name="schoolSupervisorPhone" type="tel" defaultValue={internProfile.school_supervisor_phone || ""} maxLength={25} required />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="emergencyContactName">Nama Kontak Darurat (opsional)</label>
                <input className="form-input" id="emergencyContactName" name="emergencyContactName" defaultValue={internProfile.emergency_contact_name || ""} maxLength={150} />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="emergencyContactPhone">Nomor Kontak Darurat (opsional)</label>
                <input className="form-input" id="emergencyContactPhone" name="emergencyContactPhone" type="tel" defaultValue={internProfile.emergency_contact_phone || ""} maxLength={25} />
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

      <ChangePasswordForm />
    </div>
  );
}

function ChangePasswordForm() {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);

  if (!showPasswordForm) {
    return (
      <button
        type="button"
        onClick={() => setShowPasswordForm(true)}
        className="surface p-6 bg-white w-full flex items-center justify-between gap-4 hover:border-teal-300 transition-all"
      >
        <div className="flex items-center gap-3">
          <Lock size={20} className="text-slate-500" />
          <div className="text-left">
            <p className="font-semibold text-slate-950">Ubah Password</p>
            <p className="text-xs text-slate-500">Ganti password akun Anda</p>
          </div>
        </div>
        <div className="text-teal-700 font-bold">→</div>
      </button>
    );
  }

  return (
    <form action={formAction} className="surface p-6 bg-white grid gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-950 flex items-center gap-2">
          <Lock size={18} />
          Ubah Password
        </h3>
        <button
          type="button"
          onClick={() => setShowPasswordForm(false)}
          className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
        >
          Batal
        </button>
      </div>

      <div className="grid gap-4">
        <div className="form-field">
          <label className="form-label" htmlFor="currentPassword">Password Saat Ini *</label>
          <input className="form-input" id="currentPassword" name="currentPassword" type="password" required placeholder="Masukkan password Anda" />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="newPassword">Password Baru *</label>
          <input className="form-input" id="newPassword" name="newPassword" type="password" required placeholder="Minimal 8 karakter" minLength={8} />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="confirmPassword">Konfirmasi Password Baru *</label>
          <input className="form-input" id="confirmPassword" name="confirmPassword" type="password" required placeholder="Ulangi password baru" minLength={8} />
        </div>
      </div>

      {state.message && (
        <p className={"text-sm font-semibold " + (state.ok ? "text-teal-700" : "text-red-700")}>
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => setShowPasswordForm(false)} className="button-secondary flex-1" disabled={isPending}>
          Batal
        </button>
        <button className="button-primary flex-1 flex items-center justify-center gap-2" disabled={isPending} type="submit">
          <Lock size={18} />
          {isPending ? "Mengubah..." : "Ubah Password"}
        </button>
      </div>
    </form>
  );
}
