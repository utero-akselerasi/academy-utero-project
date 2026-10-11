"use client";

import { useRef, useState, useTransition } from "react";

type Props = {
  action: (formData: FormData) => Promise<void>;
  assignmentId: string;
  questionId: string;
  type: string;
  options: Array<{ id: string; label: string }>;
  answer?: { answer_text: string | null; selected_option_ids: string[]; attachment_path: string | null };
};

export function AnswerForm({ action, assignmentId, questionId, type, options, answer }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function save(formData: FormData) {
    startTransition(async () => {
      try { await action(formData); setMessage("Tersimpan"); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menyimpan jawaban."); }
    });
  }
  return <form ref={form} action={save} className="space-y-3"><input type="hidden" name="assignmentId" value={assignmentId} /><input type="hidden" name="questionId" value={questionId} />
    {type === "multiple_choice" || type === "true_false" ? options.map((option) => <label key={option.id} className="flex gap-2"><input type="radio" name="optionId" value={option.id} defaultChecked={answer?.selected_option_ids.includes(option.id)} required />{option.label}</label>) : type === "file_upload" ? <><input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx" />{answer?.attachment_path && <p>Berkas sudah tersimpan.</p>}</> : <textarea name="answerText" className="form-input w-full" defaultValue={answer?.answer_text ?? ""} maxLength={10000} rows={type === "essay" ? 8 : 3} />}
    <div className="flex items-center gap-3"><button type="submit" disabled={pending} className="button-secondary">{pending ? "Menyimpan..." : "Simpan jawaban"}</button><span role="status" className="text-sm">{message}</span></div>
  </form>;
}
