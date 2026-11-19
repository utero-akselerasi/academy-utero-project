import { VerifyEmailForm } from "./VerifyEmailForm";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="mx-auto max-w-2xl px-4 py-12">
    <h1 className="mb-3 text-3xl font-bold">Verifikasi email</h1>
    <p className="mb-6 text-slate-600">Email diverifikasi otomatis, lalu kamu masuk ke formulir pendaftaran di dashboard.</p>
    <VerifyEmailForm token={token} />
  </main>;
}
