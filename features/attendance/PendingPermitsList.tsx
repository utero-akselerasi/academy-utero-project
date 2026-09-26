"use client";

import { reviewPermitAction } from "@/features/attendance/actions";
import { ImagePreview } from "@/features/daily-reports/ImagePreview";
import { Check, X, Calendar, FileText } from "lucide-react";

/**
 * Komponen klien, jadi ia TIDAK bisa menandatangani sendiri — `resolveStorageUrl`
 * memakai kunci service role dan hanya boleh jalan di server.
 *
 * Pemanggil (`app/dashboard/mentor/attendance/page.tsx`) menandatangani lampiran
 * lebih dulu dan mengirimkannya lewat `attachments`, di-key per id permit.
 * `isPdf` juga ikut dikirim: keputusan itu harus diambil dari object path, karena
 * signed URL berakhir `?token=...` sehingga `.endsWith('.pdf')` pada URL final
 * selalu false.
 */
export type PermitAttachment = {
  url: string | null;
  isPdf: boolean;
};

export function PendingPermitsList({
  permits,
  attachments,
}: {
  permits: any[];
  attachments: Record<string, PermitAttachment>;
}) {
  if (!permits || permits.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-bold text-slate-950 flex items-center gap-2">
        <span className="bg-amber-100 text-amber-700 p-1.5 rounded-lg"><FileText size={18} /></span>
        Antrean Izin / Sakit Menunggu Approval ({permits.length})
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {permits.map((p) => (
          <form key={p.id} action={reviewPermitAction} className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
              {p.permit_type === 'sick' ? 'SAKIT' : 'IZIN'}
            </div>
            
            <div>
              <h3 className="font-extrabold text-slate-900 truncate pr-10">{p.intern_profiles?.full_name || 'Tanpa Nama'}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Calendar size={12} /> {p.start_date} s/d {p.end_date}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs flex-1">
              <span className="font-bold text-[10px] text-slate-400 uppercase block mb-1">Alasan:</span>
              <p className="text-slate-700">{p.reason}</p>
            </div>

            {attachments[p.id]?.url && (
              <div>
                <span className="font-bold text-[10px] text-slate-400 uppercase block mb-1">Lampiran Dokumen</span>
                {attachments[p.id].isPdf ? (
                  <a href={attachments[p.id].url!} target="_blank" rel="noreferrer" className="text-teal-600 font-bold text-xs underline hover:text-teal-700">Lihat PDF Bukti</a>
                ) : (
                  <ImagePreview src={attachments[p.id].url!} alt="Bukti" className="max-h-20 w-auto object-contain rounded border border-slate-200" />
                )}
              </div>
            )}

            <input type="hidden" name="permitId" value={p.id} />
            
            <div className="flex flex-col gap-1 mt-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Ubah Tgl Selesai (Opsional)</label>
              <input type="date" name="endDate" defaultValue={p.end_date} required className="text-xs p-1.5 border border-slate-300 rounded" />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button type="submit" name="status" value="approved" className="button-primary py-2 text-xs flex justify-center items-center gap-1">
                <Check size={14} /> Approve
              </button>
              <button type="submit" name="status" value="rejected" className="button-secondary py-2 text-xs flex justify-center items-center gap-1 text-red-600 hover:bg-red-50 hover:border-red-200">
                <X size={14} /> Tolak
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
