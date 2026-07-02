"use client";

import { addTaskAttachmentAction } from "@/features/tasks/actions";
import { Paperclip } from "lucide-react";
import { useState } from "react";

type Props = {
  cardId: string;
};

export function TaskAttachmentForm({ cardId }: Props) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget; // Simpan form reference secara lokal
    setIsUploading(true);
    try {
      const formData = new FormData(form);
      await addTaskAttachmentAction(formData);
      if (form && typeof form.reset === 'function') { try { form.reset(); } catch (e) {} }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="mt-3 border-t border-slate-200 pt-3 flex items-center gap-2">
      <input name="cardId" type="hidden" value={cardId} />
      <label className="flex items-center gap-1 text-xs text-slate-500 font-bold border border-slate-300 rounded px-2 py-1 bg-white cursor-pointer hover:border-teal-500 hover:text-teal-700">
        <Paperclip size={14} />
        <span>Pilih File</span>
        <input name="attachment" type="file" required className="hidden" onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            e.target.form?.requestSubmit();
          }
        }} />
      </label>
      {isUploading && <span className="text-xs text-slate-500">Mengunggah...</span>}
    </form>
  );
}
