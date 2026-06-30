"use client";

import { submitInternTestimonialAction } from "@/features/cms/actions";
import { useState, useTransition } from "react";
import { MessageSquare, Send } from "lucide-react";

type Props = {
  siteId: string;
  existingTestimonial?: {
    id: string;
    quote: string;
    status: string;
  } | null;
};

export function AlumniTestimonialForm({ siteId, existingTestimonial }: Props) {
  const [quote, setQuote] = useState(existingTestimonial?.quote || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await submitInternTestimonialAction(formData);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengirim testimoni.");
      }
    });
  };

  if (existingTestimonial) {
    return (
      <div className="surface p-6 bg-teal-50/50 border border-teal-200 rounded-xl space-y-3">
        <h3 className="text-lg font-black text-teal-950 flex items-center gap-2">
          <MessageSquare className="text-teal-700" size={20} />
          <span>Testimoni Alumni Anda</span>
        </h3>
        <p className="text-sm text-teal-800 leading-relaxed">
          Terima kasih telah memberikan testimoni! Ulasan Anda sangat berharga bagi kami.
        </p>
        <div className="p-4 bg-white border border-teal-100 rounded-lg">
          <p className="text-sm text-slate-700 italic leading-relaxed">
            "{existingTestimonial.quote}"
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 uppercase">
            Status: {existingTestimonial.status === "published" ? "Diterbitkan" : "Menunggu Persetujuan Admin"}
          </span>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="surface p-6 bg-teal-50 border border-teal-200 rounded-xl text-center space-y-2">
        <h3 className="text-lg font-black text-teal-950">Testimoni Terkirim!</h3>
        <p className="text-sm text-teal-800">
          Terima kasih atas testimoni yang Anda berikan. Admin akan meninjau dan menerbitkannya segera di halaman utama.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="surface p-6 bg-white border border-slate-200 rounded-xl space-y-4">
      <div>
        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <MessageSquare className="text-teal-700" size={20} />
          <span>Tulis Testimoni Alumni</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Berikan ulasan, kesan, pesan, atau testimoni pengalaman Anda selama menjalani program magang di Utero Academy. Testimoni Anda akan ditampilkan di halaman landing page utama setelah disetujui admin.
        </p>
      </div>

      <input type="hidden" name="siteId" value={siteId} />

      <div className="form-field">
        <label className="form-label text-xs font-bold text-slate-700">Kutipan Testimoni *</label>
        <textarea
          name="quote"
          required
          rows={4}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="Tuliskan testimoni Anda di sini (misal: Magang di Utero Academy memberikan saya banyak sekali ilmu praktis DevOps dan web development...)"
          className="form-input text-sm"
        />
      </div>

      <div className="form-field">
        <label className="form-label text-xs font-bold text-slate-700">Foto Profil (Opsional)</label>
        <input
          type="file"
          name="photo"
          accept="image/*"
          className="form-input text-xs"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Pilih foto profil terbaik Anda untuk ditampilkan di samping testimoni.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-600 font-semibold">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !quote.trim()}
        className="button-primary w-full flex items-center justify-center gap-1.5 font-bold"
      >
        <Send size={16} />
        <span>{isPending ? "Mengirim..." : "Kirim Testimoni"}</span>
      </button>
    </form>
  );
}
