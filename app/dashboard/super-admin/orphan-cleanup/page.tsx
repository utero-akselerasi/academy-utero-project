import Link from "next/link";
import { detectOrphanData } from "@/features/super-admin/queries";
import { cleanupOrphanDataAction } from "@/features/super-admin/actions";

export default async function SuperAdminOrphanCleanupPage() {
  const { orphanContacts, orphanInterns, total, error } = await detectOrphanData();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-red-700">Super Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Pembersih Data Orphan</h1>
          <p className="mt-2 max-w-3xl leading-7 text-slate-600">
            Deteksi dan bersihkan data broken: perwakilan sekolah tanpa user valid, siswa terhubung ke sekolah yang sudah dihapus.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="button-secondary" href="/dashboard/super-admin/schools">Manajemen Instansi</Link>
          <Link className="button-secondary" href="/dashboard/super-admin">Kembali</Link>
        </div>
      </div>

      {error ? (
        <div className="surface mb-4 p-4 text-sm font-semibold text-red-700">
          Gagal mendeteksi orphan data. Cek koneksi database.
        </div>
      ) : null}

      {total === 0 ? (
        <div className="surface rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-lg font-bold text-emerald-950">✓ Database Bersih</p>
          <p className="mt-2 text-sm text-emerald-700">Tidak ada data orphan yang ditemukan. Data Anda dalam kondisi baik.</p>
        </div>
      ) : (
        <>
          <div className="surface mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="text-base font-black text-red-950">⚠ Ditemukan {total} Data Orphan</h2>
            <p className="mt-2 text-sm text-red-700">Data ini terisolasi dan sebaiknya dibersihkan untuk menjaga integritas database.</p>
          </div>

          <div className="grid gap-6">
            {orphanContacts.length > 0 && (
              <section className="surface overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <h3 className="text-lg font-black text-slate-950">Perwakilan Sekolah Orphan ({orphanContacts.length})</h3>
                  <p className="mt-1 text-sm text-slate-600">User tidak ada atau sekolah sudah dihapus</p>
                </div>
                <div className="p-6">
                  <div className="mb-4 max-h-64 overflow-y-auto space-y-2">
                    {orphanContacts.map((contact) => (
                      <div key={contact.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="font-semibold text-slate-900">{contact.name}</p>
                        <p className="text-xs text-slate-500">ID: {contact.id}</p>
                        <p className="text-xs text-slate-500">User: {contact.user_id ? "Tidak ditemukan di auth" : "Kosong"}</p>
                      </div>
                    ))}
                  </div>
                  <form action={cleanupOrphanDataAction}>
                    <input type="hidden" name="orphanType" value="contacts" />
                    <button className="w-full rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800">
                      Hapus {orphanContacts.length} Perwakilan Orphan
                    </button>
                  </form>
                </div>
              </section>
            )}

            {orphanInterns.length > 0 && (
              <section className="surface overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <h3 className="text-lg font-black text-slate-950">Siswa Orphan ({orphanInterns.length})</h3>
                  <p className="mt-1 text-sm text-slate-600">Terhubung ke sekolah yang sudah dihapus</p>
                </div>
                <div className="p-6">
                  <div className="mb-4 max-h-64 overflow-y-auto space-y-2">
                    {orphanInterns.map((intern) => (
                      <div key={intern.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="font-semibold text-slate-900">{intern.full_name}</p>
                        <p className="text-xs text-slate-500">ID: {intern.id}</p>
                        <p className="text-xs text-slate-500">Sekolah ID: {intern.school_id} (tidak ada)</p>
                      </div>
                    ))}
                  </div>
                  <form action={cleanupOrphanDataAction}>
                    <input type="hidden" name="orphanType" value="interns" />
                    <button className="w-full rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800">
                      Lepaskan {orphanInterns.length} Siswa dari Sekolah Hilang
                    </button>
                  </form>
                </div>
              </section>
            )}

            <section className="surface overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h3 className="text-lg font-black text-slate-950">Bersihkan Semua Orphan</h3>
              </div>
              <div className="p-6">
                <p className="mb-4 text-sm text-slate-600">Jalankan cleanup otomatis untuk semua jenis data orphan ({total} items).</p>
                <form action={cleanupOrphanDataAction}>
                  <input type="hidden" name="orphanType" value="all" />
                  <button className="w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800">
                    Bersihkan Semua ({total} Data Orphan)
                  </button>
                </form>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
