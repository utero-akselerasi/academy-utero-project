import { getCmsData } from "@/features/cms/queries";
import { HelpCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const siteId = "c6e8f645-5f5e-4b33-a66a-bf92e047c212";
  let faqs: any[] = [];

  try {
    const res = await getCmsData(siteId);
    if (res && res.faqs) {
      faqs = res.faqs.filter(f => f.status === "published");
    }
  } catch (err) {
    console.error("Gagal memuat FAQ:", err);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div className="text-center">
        <p className="text-sm font-bold uppercase text-teal-700">Tanya Jawab</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-950">FAQ Utero Academy</h1>
        <p className="mt-4 max-w-2xl mx-auto leading-relaxed text-slate-600">
          Temukan jawaban atas pertanyaan-pertanyaan yang sering diajukan mengenai pendaftaran, program magang, dan fasilitas kami.
        </p>
      </div>

      <div className="space-y-4">
        {faqs.length === 0 ? (
          <div className="surface p-8 text-center text-slate-500">
            Belum ada daftar FAQ yang dipublikasikan.
          </div>
        ) : (
          faqs.map((faq) => (
            <details key={faq.id} className="group border border-slate-200 rounded-xl bg-white p-5 shadow-sm transition-all [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle size={16} className="text-teal-700" />
                  <span>{faq.question}</span>
                </h3>
                <span className="transition duration-300 group-open:-rotate-180 text-xs text-slate-400">
                  ▼
                </span>
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-slate-600 border-t border-slate-100 pt-3">
                {faq.answer}
              </p>
            </details>
          ))
        )}
      </div>
    </main>
  );
}
