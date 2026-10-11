import { ApplicantSignupForm } from "@/features/registration/ApplicantSignupForm";

export default function ApplicantRegisterPage() {
  return <main className="mx-auto max-w-2xl px-4 py-12"><h1 className="mb-3 text-3xl font-bold">Buat akun calon peserta</h1><p className="mb-6 text-slate-600">Verifikasi email lebih dahulu. Akun pelamar bukan role peserta magang.</p><ApplicantSignupForm /></main>;
}
