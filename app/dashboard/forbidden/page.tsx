import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
      <section className="surface w-full p-8 text-center">
        <p className="text-sm font-bold uppercase text-red-700">403 · Akses Ditolak</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Kamu tidak memiliki akses ke halaman ini.</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Gunakan dashboard yang sesuai dengan role akunmu. Hubungi administrator bila akses ini seharusnya tersedia.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link className="button-primary" href="/">
            Kembali ke halaman utama
          </Link>
          <Link className="button-secondary" href="/login">
            Masuk dengan akun lain
          </Link>
        </div>
      </section>
    </main>
  );
}
