"use client";

import { useState } from "react";
import { saveAssessmentAction } from "@/features/assessments/actions";
import { Award, X, Check, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  intern: {
    id: string;
    full_name: string;
    email: string | null;
    major: string | null;
    status: string;
    assessment: {
      id: string;
      final_score: number;
      status: string;
      feedback: string | null;
      score: any;
    } | null;
  };
  searchQuery: string;
};

export function AssessmentModal({ intern, searchQuery }: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [submitType, setSubmitType] = useState<"draft" | "finalize">("draft");

  const ass = intern.assessment;
  const isFinalized = ass?.status === "finalized";
  const defaultScores = ass?.score as any || {};

  // Initialize criteria list from database or default three
  const initialCriteria = Object.keys(defaultScores).length > 0 
    ? Object.keys(defaultScores).map(k => ({ name: k, score: defaultScores[k] }))
    : [
        { name: "technical", score: "" },
        { name: "discipline", score: "" },
        { name: "attitude", score: "" }
      ];

  const [criteria, setCriteria] = useState<{ name: string; score: string | number }[]>(initialCriteria);

  const handleAddCriteria = () => {
    setCriteria([...criteria, { name: "", score: "" }]);
  };

  const handleRemoveCriteria = (index: number) => {
    setCriteria(criteria.filter((_, idx) => idx !== index));
  };

  const handleCriteriaChange = (index: number, field: "name" | "score", value: string) => {
    const updated = [...criteria];
    updated[index][field] = value;
    setCriteria(updated);
  };

  const handleClose = () => {
    router.push("/dashboard/mentor/assessments?q=" + searchQuery);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (submitType === "finalize") {
      const ok = confirm("Apakah Anda yakin ingin mem-finalisasi penilaian? Aksi ini akan menerbitkan sertifikat magang otomatis dan tidak dapat diubah lagi.");
      if (!ok) return;
    }

    setIsPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("submitType", submitType);
      
      await saveAssessmentAction(formData);
      handleClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan penilaian.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 text-teal-700">
            <Award size={20} />
            <div>
              <h3 className="text-lg font-black text-slate-900">Penilaian Akhir</h3>
              <p className="text-xs text-slate-400 font-semibold">Siswa: {intern.full_name}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
            disabled={isPending}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <input type="hidden" name="internId" value={intern.id} />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Kriteria & Aspek Penilaian *</span>
              {!isFinalized && (
                <button
                  type="button"
                  onClick={handleAddCriteria}
                  className="text-[10px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-0.5 border border-teal-200 bg-teal-50 px-2 py-0.5 rounded"
                >
                  <Plus size={10} /> Tambah Kriteria
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {criteria.map((c, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    name="criteriaName"
                    value={c.name}
                    onChange={(e) => handleCriteriaChange(idx, "name", e.target.value)}
                    required
                    placeholder="Nama Kriteria (misal: Disiplin)"
                    disabled={isFinalized || isPending}
                    className="form-input text-xs flex-1"
                  />
                  <input
                    type="number"
                    name="criteriaScore"
                    value={c.score}
                    onChange={(e) => handleCriteriaChange(idx, "score", e.target.value)}
                    required
                    min="0"
                    max="100"
                    placeholder="Skor"
                    disabled={isFinalized || isPending}
                    className="form-input text-xs w-20 text-center font-bold"
                  />
                  {!isFinalized && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCriteria(idx)}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label text-xs" htmlFor="feedback">Catatan Evaluasi / Rekomendasi *</label>
            <textarea
              className="form-input text-xs bg-slate-50 focus:bg-white"
              id="feedback"
              name="feedback"
              rows={3}
              placeholder="Jelaskan evaluasi keseluruhan siswa magang ini..."
              required
              defaultValue={ass?.feedback || ""}
              disabled={isFinalized || isPending}
            />
          </div>

          {isFinalized && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-800 text-xs font-bold space-y-1">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>Penilaian telah difinalisasi.</span>
              </span>
              <p className="font-medium text-[10px] text-slate-500">
                Sertifikat magang otomatis telah terbit dan dapat diunduh oleh siswa di portal mereka.
              </p>
            </div>
          )}

          {/* Tombol Aksi */}
          <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="button-secondary text-xs h-9 py-0 px-3.5 min-h-0 font-semibold"
              disabled={isPending}
            >
              {isFinalized ? "Tutup" : "Batal"}
            </button>
            
            {!isFinalized && (
              <>
                <button
                  type="submit"
                  onClick={() => setSubmitType("draft")}
                  disabled={isPending}
                  className="button-secondary text-xs h-9 py-0 px-3.5 min-h-0 font-semibold text-teal-700 border-teal-200 hover:bg-teal-50"
                >
                  {isPending && submitType === "draft" ? "Menyimpan..." : "Simpan Draft"}
                </button>
                <button
                  type="submit"
                  onClick={() => setSubmitType("finalize")}
                  disabled={isPending}
                  className="button-primary text-xs h-9 py-0 px-3.5 min-h-0 font-bold flex items-center gap-1"
                >
                  <Check size={14} />
                  <span>{isPending && submitType === "finalize" ? "Memproses..." : "Finalisasi"}</span>
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
