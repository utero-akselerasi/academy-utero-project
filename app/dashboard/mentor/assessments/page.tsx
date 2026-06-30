import { getInternsForAssessment } from "@/features/assessments/queries";
import { AssessmentModal } from "@/features/assessments/AssessmentModal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";

type PageProps = {
  searchParams: Promise<{ detailInternId?: string; q?: string }>;
};

export default async function MentorAssessmentsPage({ searchParams }: PageProps) {
  const { detailInternId, q: searchQuery = "" } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: interns, error } = await getInternsForAssessment();

  // Filter pencarian nama
  const filtered = interns.filter(i => 
    i.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const detailIntern = detailInternId ? interns.find(i => i.id === detailInternId) : undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 relative">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Admin / Pembimbing</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Penilaian Akhir & Sertifikat</h1>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            Berikan evaluasi nilai kinerja dan feedback akhir bagi peserta magang. Finalisasi penilaian untuk menerbitkan sertifikat otomatis.
          </p>
        </div>
        <span className="status-pill">{interns.length} peserta aktif</span>
      </div>

      {error ? (
        <div className="surface p-4 text-sm font-semibold text-red-700 mb-6">
          Gagal memuat data peserta. Cek koneksi database.
        </div>
      ) : null}

      {/* Bar Pencarian */}
      <div className="mb-6 max-w-md">
        <form className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={15} className="text-slate-400" />
          </div>
          <input
            className="form-input pl-10"
            name="q"
            defaultValue={searchQuery}
            placeholder="Cari nama peserta magang..."
          />
        </form>
      </div>

      {/* Tabel Minimalis Pengguna */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs">
                <th className="p-4">Nama Peserta Magang</th>
                <th className="p-4">Jurusan</th>
                <th className="p-4">Email</th>
                <th className="p-4">Nilai Akhir</th>
                <th className="p-4">Status Penilaian</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Tidak ada data peserta magang aktif.
                  </td>
                </tr>
              ) : (
                filtered.map((intern) => {
                  const ass = intern.assessment;
                  return (
                    <tr key={intern.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 leading-snug">{intern.full_name}</div>
                      </td>
                      <td className="p-4 text-slate-600 font-semibold">{intern.major || "-"}</td>
                      <td className="p-4 text-slate-600 font-semibold">{intern.email || "-"}</td>
                      <td className="p-4 text-slate-800 font-black">
                        {ass?.final_score !== undefined ? ass.final_score : "-"}
                      </td>
                      <td className="p-4">
                        {ass ? (
                          <span className={"px-2 py-0.5 rounded text-[10px] font-bold uppercase " + (
                            ass.status === "finalized"
                              ? "bg-teal-50 border border-teal-200 text-teal-800"
                              : "bg-amber-50 border border-amber-200 text-amber-800"
                          )}>
                            {ass.status === "finalized" ? "finalized" : "draft"}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 border border-red-200 text-red-800">
                            belum dinilai
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={"/dashboard/mentor/assessments?q=" + searchQuery + "&detailInternId=" + intern.id}
                          className="button-secondary text-xs font-bold py-1 px-3 min-h-0"
                        >
                          {ass?.status === "finalized" ? "Detail" : "Beri Nilai"}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP MODAL CLIENT COMPONENT */}
      {detailIntern && (
        <AssessmentModal intern={detailIntern as any} searchQuery={searchQuery} />
      )}
    </main>
  );
}
