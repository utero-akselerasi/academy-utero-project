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
            Kelola penempatan bimbingan dengan menugaskan mentor untuk membimbing anak magang.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h2 className="mb-4 text-lg font-bold text-slate-950">Daftar Penempatan Aktif ({assignments.length})</h2>
          
          <div className="grid gap-3">
            {assignments.length === 0 && (
              <div className="surface p-8 text-center text-slate-600">
                Belum ada penempatan mentor yang dibuat.
              </div>
            )}

            {assignments.map((assignment) => {
              const internName = assignment.intern_profiles?.full_name ?? "Peserta";
              const mentorName = assignment.mentor_profiles?.user_profiles?.full_name ?? "Mentor";
              return (
                <article className="surface p-4 flex items-center justify-between gap-4" key={assignment.id}>
                  <div>
                    <h3 className="font-bold text-slate-950">{internName}</h3>
                    <p className="text-sm text-slate-600">Mentor: <span className="font-bold">{mentorName}</span></p>
                    <p className="text-xs text-slate-400 mt-1">Sejak: {formatDate(assignment.started_at)}</p>
                  </div>
                  <form action={removeMentorAssignmentAction}>
                    <input name="assignmentId" type="hidden" value={assignment.id} />
                    <button className="button-secondary text-red-600 hover:bg-red-50" type="submit">
                      <X size={16} />
                      Batalkan
                    </button>
                  </form>
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
              <label className="form-label" htmlFor="mentorSelect">Mentor Pembimbing</label>
              <select id="mentorSelect" name="mentorId" required className="form-input">
                <option value="">Pilih mentor...</option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.full_name}
                  </option>
                ))}
              </select>
            </div>

            <button className="button-primary w-full" type="submit">
              <Plus size={16} />
              Tugaskan Mentor
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
