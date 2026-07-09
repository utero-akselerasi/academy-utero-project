"use client";

import { submitPermitAction, type FormState } from "@/features/attendance/actions";
import { useActionState, useState } from "react";
import { CalendarRange, FileText, Upload } from "lucide-react";

const initialState: FormState = { ok: false, message: "" };

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function PermitForm() {
  const [state, formAction, isPending] = useActionState(submitPermitAction, initialState);
  const [permitType, setPermitType] = useState<"permit" | "sick">("permit");
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  return (
    <form action={formAction} className="surface grid gap-5 p-6 bg-white border border-slate-200 rounded-xl">
      <div className="flex flex-col items-center text-center gap-2 mb-2">
        <span className="rounded-full bg-amber-100 p-4 text-amber-700">
          <CalendarRange size={32} />
        </span>
        <h3 className="text-xl font-bold text-slate-950">Form Izin / Sakit</h3>
        <p className="text-sm text-slate-600">
          Kirim permohonan izin atau sakit jika hari ini Anda berhalangan hadir magang.
        </p>
      </div>

      {state.message && (
        <p className={`rounded-md p-3 text-sm font-semibold border ${
          state.ok 
            ? "bg-teal-50 border-teal-200 text-teal-800" 
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {state.message}
        </p>
      )}

      {/* Tipe Izin */}
      <div className="form-field">
        <label className="form-label font-bold text-slate-700">Jenis Berhalangan *</label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <label className={`flex items-center justify-center gap-2 border-2 rounded-xl p-3 cursor-pointer transition-all ${
            permitType === "permit" 
              ? "border-teal-600 bg-teal-50/50 text-teal-900 font-extrabold" 
              : "border-slate-200 hover:border-slate-300 text-slate-700"
          }`}>
            <input 
              type="radio" 
              name="permitType" 
              value="permit" 
              checked={permitType === "permit"}
              onChange={() => setPermitType("permit")}
              className="hidden"
            />
            <FileText size={16} />
            <span>Izin Mandiri</span>
          </label>

          <label className={`flex items-center justify-center gap-2 border-2 rounded-xl p-3 cursor-pointer transition-all ${
            permitType === "sick" 
              ? "border-teal-600 bg-teal-50/50 text-teal-900 font-extrabold" 
              : "border-slate-200 hover:border-slate-300 text-slate-700"
          }`}>
            <input 
              type="radio" 
              name="permitType" 
              value="sick" 
              checked={permitType === "sick"}
              onChange={() => setPermitType("sick")}
              className="hidden"
            />
            <span>Sakit (Surat Dokter)</span>
          </label>
        </div>
      </div>

      {/* Rentang Tanggal Izin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-field">
          <label className="form-label font-bold text-slate-700" htmlFor="startDate">Tanggal Mulai *</label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={getTodayDate()}
            className="form-input text-sm"
          />
        </div>

        <div className="form-field">
          <label className="form-label font-bold text-slate-700" htmlFor="endDate">Tanggal Selesai *</label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            defaultValue={getTodayDate()}
            className="form-input text-sm"
          />
        </div>
      </div>

      {/* Alasan / Deskripsi */}
      <div className="form-field">
        <label className="form-label font-bold text-slate-700" htmlFor="reasonInput">Alasan Keterangan *</label>
        <textarea
          id="reasonInput"
          name="reason"
          required
          rows={3}
          placeholder={permitType === "sick" ? "Jelaskan sakit yang diderita (misal: Demam tinggi, Flu berat)..." : "Jelaskan alasan izin (misal: Ada keperluan keluarga mendesak)..."}
          className="form-input text-sm"
        />
      </div>

      {/* Upload Surat Dokter */}
      {permitType === "sick" && (
        <div className="form-field animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="form-label font-bold text-slate-700">Surat Keterangan Dokter *</label>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-3 cursor-pointer hover:border-teal-500 bg-slate-50">
            <Upload size={16} className="text-slate-500" />
            <span className="text-sm text-slate-700 font-semibold truncate max-w-[200px] sm:max-w-xs">
              {selectedFileName ? "Terpilih: " + selectedFileName : "Pilih file surat dokter..."}
            </span>
            <input
              name="certificate"
              type="file"
              accept="image/*,application/pdf"
              required
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setSelectedFileName(e.target.files[0].name);
                } else {
                  setSelectedFileName("");
                }
              }}
            />
          </label>
          <p className="text-[10px] text-slate-400 mt-1">Format file: Gambar atau PDF. Surat dokter wajib dilampirkan.</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="button-primary w-full font-bold py-3 mt-2"
      >
        {isPending ? "Mengirim Pengajuan..." : "Kirim Permohonan Izin"}
      </button>
    </form>
  );
}


