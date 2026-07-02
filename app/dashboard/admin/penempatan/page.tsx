import { getActiveInterns, getMentors, getMentorAssignments } from "@/features/admin/queries";
import { assignMentorAction, removeMentorAssignmentAction } from "@/features/admin/actions";
import { Plus, X } from "lucide-react";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

export default async function AdminPenempatanPage() {
  const interns = await getActiveInterns();
  const mentors = await getMentors();
  const assignments = await getMentorAssignments();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Penempatan Bimbingan Magang</h1>
          <p className="mt-2 text-slate-600">
            Kelola penempatan bimbingan dengan menugaskan administrator pembimbing untuk membimbing anak magang.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950">Daftar Penempatan Aktif ({assignments.length})</h2>
          
          <div className="grid gap-3">
            {assignments.length === 0 && (
              <div className="surface p-8 text-center text-slate-600">
                Belum ada penempatan pembimbing yang dibuat.
              </div>
            )}

            {assignments.map((assignment) => {
              const intern = assignment.intern_profiles;
              const internName = intern?.full_name ?? "Peserta";
              const mentorName = assignment.mentor_profiles?.user_profiles?.full_name ?? "Pembimbing";
              return (
                <article className="surface p-5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all flex flex-col justify-between gap-4 md:flex-row md:items-center" key={assignment.id}>
                  <div className="space-y-2 flex-1">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{internName}</h3>
                      <p className="text-xs text-teal-700 font-bold mt-0.5">
                        {intern?.major || "No Major"} — {intern?.school_name || "Sekolah Umum"}
                      </p>
                    </div>
                    
                    <div className="grid gap-x-4 gap-y-1 text-xs text-slate-500 md:grid-cols-2">
                      <div>
                        <span className="font-semibold text-slate-400 block uppercase text-[9px] tracking-wider">Email</span>
                        <span className="font-semibold text-slate-700">{intern?.email || "-"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400 block uppercase text-[9px] tracking-wider">WhatsApp</span>
                        <span className="font-semibold text-slate-700">{intern?.phone || "-"}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="font-semibold text-slate-400">Pembimbing:</span>{" "}
                        <span className="font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{mentorName}</span>
                      </div>
                      <div className="text-slate-400">
                        Sejak: <span className="font-semibold text-slate-600">{formatDate(assignment.started_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center">
                    <form action={removeMentorAssignmentAction} className="w-full">
                      <input name="assignmentId" type="hidden" value={assignment.id} />
                      <button className="button-secondary text-red-600 hover:bg-red-50 font-bold w-full md:w-auto flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-slate-200 hover:border-red-200 rounded-lg" type="submit" title="Batalkan Penugasan">
                        <X size={14} />
                        <span>Batalkan</span>
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950">Tugaskan Bimbingan Baru</h2>
          <form action={assignMentorAction} className="surface grid gap-4 p-5">
            <div className="form-field">
              <label className="form-label" htmlFor="internSelect">Peserta Magang Aktif</label>
              <select id="internSelect" name="internId" required className="form-input">
                <option value="">Pilih anak magang...</option>
                {interns.map((intern) => (
                  <option key={intern.id} value={intern.id}>
                    {intern.full_name} ({intern.major || "No Major"})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="mentorSelect">Admin Pembimbing</label>
              <select id="mentorSelect" name="mentorId" required className="form-input">
                <option value="">Pilih admin pembimbing...</option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.full_name}
                  </option>
                ))}
              </select>
            </div>

            <button className="button-primary w-full" type="submit">
              <Plus size={16} />
              Tugaskan Pembimbing
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
