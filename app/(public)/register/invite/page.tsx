import { InviteForm } from "./InviteForm";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="mx-auto max-w-2xl px-4 py-12">
    <h1 className="mb-6 text-3xl font-bold">Aktifkan akun undangan</h1>
    <InviteForm token={token} />
  </main>;
}
