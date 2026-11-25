import { ForgotPasswordForm } from "@/features/auth/PasswordResetForms";

export default function ForgotPasswordPage() {
  return <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-md content-center gap-5 px-4 py-12">
    <header><p className="text-sm font-bold uppercase text-teal-700">Pemulihan akun</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Lupa password?</h1><p className="mt-2 text-sm leading-6 text-slate-600">Masukkan email akun. Kami akan mengirim tautan untuk membuat password baru jika akun terdaftar.</p></header>
    <ForgotPasswordForm />
  </main>;
}
