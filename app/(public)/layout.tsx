import Link from "next/link";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link className="font-bold text-slate-950" href="/">
            Utero Academy
          </Link>
          <nav className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Link
              className="rounded-md px-3 py-2 hover:bg-slate-100"
              href="/daftar">
              Daftar
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-slate-100"
              href="/login">
              Login
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
