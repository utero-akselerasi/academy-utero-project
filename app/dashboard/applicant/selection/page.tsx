import Link from "next/link";
import { requireApplicant } from "@/features/auth/guards";
import { getApplicantSelection } from "@/features/selection/applicant";
import { startSelectionAttemptAction } from "@/features/selection/applicant-actions";

export default async function ApplicantSelectionPage() {
  await requireApplicant();
  const data = await getApplicantSelection();
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8"><header><p className="text-sm font-bold uppercase text-teal-700">Calon peserta</p><h1 className="text-3xl font-bold">Seleksi Magang</h1><p>Siapkan materi, kerjakan tes yang ditugaskan, lalu pantau keputusan.</p></header>
    {data.applications.map((application) => <section className="surface space-y-4 p-6" key={application.id}><h2 className="text-xl font-bold">{application.full_name}</h2><p>Status: {application.selection_status}</p>
      {data.materials.filter((material) => material.track_id === application.selection_track_id).map((material) => <details key={material.id} className="border-t pt-2"><summary className="cursor-pointer font-semibold">{material.title}</summary><p className="whitespace-pre-wrap">{(material.content as { body?: string })?.body}</p></details>)}
      {data.assignments.filter((assignment) => assignment.application_id === application.id).map((assignment) => {
        const test = data.packages.find((item) => item.id === assignment.package_id);
        const attempt = data.attempts.find((item) => item.assignment_id === assignment.id);
        const now = data.currentTime;
        const available = !!test?.is_published && (!test.available_from || now >= Date.parse(test.available_from)) && (!test.available_until || now < Date.parse(test.available_until)) && (!assignment.due_at || now < Date.parse(assignment.due_at));
        return <article key={assignment.id} className="space-y-2 border-t pt-3"><h3 className="font-bold">{test?.title ?? "Tes"}</h3><p>{test?.description} · {test?.duration_minutes} menit · batas {assignment.due_at ?? "Tidak ditetapkan"}</p><p>Status: {assignment.status} · percobaan: {attempt?.attempt_number ?? 0}/{assignment.max_attempts}</p>{attempt?.status === "in_progress" ? <Link className="button-primary inline-flex" href={`/dashboard/applicant/selection/${assignment.id}`}>Lanjutkan tes</Link> : available && (attempt?.attempt_number ?? 0) < assignment.max_attempts && (!attempt || ["graded", "expired", "cancelled"].includes(attempt.status)) ? <form action={startSelectionAttemptAction}><input type="hidden" name="assignmentId" value={assignment.id} /><button className="button-primary">Mulai tes</button></form> : null}</article>;
      })}
      {data.results.find((result) => result.applicationId === application.id)?.rows.map((result: { decision_id: string; result: string; final_score: number | null; public_note: string | null }) => <p key={result.decision_id} className="border-t pt-2">Hasil: {result.result} · Nilai: {result.final_score ?? "Tidak berlaku"} · {result.public_note}</p>)}
    </section>)}
  </main>;
}
