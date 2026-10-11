import { requireApplicant } from "@/features/auth/guards";
import { getApplicantAttempt } from "@/features/selection/applicant";
import { saveSelectionAnswerAction, submitSelectionAttemptAction } from "@/features/selection/applicant-actions";
import { AnswerForm } from "@/features/selection/AnswerForm";

export default async function ApplicantTestPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  await requireApplicant();
  const { assignmentId } = await params;
  const { attempt, test, questions, options, answers, active } = await getApplicantAttempt(assignmentId);
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8"><header><h1 className="text-3xl font-bold">{test.title}</h1><p>{test.description}</p><p>Batas pengerjaan: {attempt?.expires_at ?? "Belum dimulai"}</p></header>
    {!active ? <p className="surface p-5">Tes belum dimulai, selesai, atau waktu habis. Kembali ke daftar tes.</p> : <>
      {questions.map((question, index) => <section className="surface space-y-3 p-5" key={question.id}><h2 className="font-bold">{index + 1}. {(question.prompt as { text?: string })?.text ?? "Pertanyaan"} ({question.points} poin)</h2><AnswerForm action={saveSelectionAnswerAction} assignmentId={assignmentId} questionId={question.id} type={question.question_type} options={options.filter((option) => option.question_id === question.id)} answer={answers.find((answer) => answer.question_id === question.id)} /></section>)}
      <form action={submitSelectionAttemptAction} className="surface p-5"><input type="hidden" name="assignmentId" value={assignmentId} /><button className="button-primary">Kirim seluruh jawaban</button></form>
    </>}
  </main>;
}
