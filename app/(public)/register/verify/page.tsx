import { VerifyEmailForm } from "./VerifyEmailForm";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="mx-auto max-w-2xl px-4 py-12">
    <h1 className="mb-3 text-3xl font-bold">Verifikasi email</h1>
    <p className="mb-6 text-slate-600">Konfirmasi dilakukan melalui POST agar token tidak dipakai otomatis oleh pemindai tautan email.</p>
    <VerifyEmailForm token={token} />
  </main>;
}
