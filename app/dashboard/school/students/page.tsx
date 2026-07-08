import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSchoolInterns, getSchoolProfile } from "@/features/school/queries";

export default async function SchoolStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schoolProfile } = await getSchoolProfile(user.id);
  if (!schoolProfile) redirect("/dashboard/school");

  const { data: interns } = await getSchoolInterns(schoolProfile.id);
  const filtered = interns.filter((intern) => intern.full_name.toLowerCase().includes(q.toLowerCase()) || (intern.email || "").toLowerCase().includes(q.toLowerCase()) || (intern.major || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daftar Siswa</h1>
            <p className="text-sm text-slate-500">{schoolProfile.name}</p>
          </div>
          <form className="w-full md:max-w-md">
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari nama, email, atau jurusan..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
            />
          </form>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Nama</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Jurusan</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Nilai</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((intern) => (
                <tr key={intern.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{intern.full_name}</p>
                    <p className="text-xs text-slate-500">{intern.email || "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{intern.major || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{intern.status}</td>
                  <td className="px-4 py-3 text-slate-600">{intern.assessment?.final_score ?? "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/school/students/${intern.id}`} className="font-semibold text-blue-700 hover:text-blue-800">Detail</Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>Tidak ada siswa ditemukan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
