"use client";

import { checkInAction, type FormState } from "@/features/attendance/actions";
import { useActionState, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { LiveCameraInput } from "./LiveCameraInput";

const initialState: FormState = { ok: false, message: "" };

export function CheckInForm() {
  const [state, formAction, isPending] = useActionState(checkInAction, initialState);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setError("Gagal mengambil lokasi: " + err.message)
      );
    } else {
      setError("Browser tidak mendukung geolokasi.");
    }
  }, []);

  return (
    <form action={formAction} className="surface grid gap-5 p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="rounded-full bg-teal-100 p-4 text-teal-700">
          <MapPin size={32} />
        </span>
        <h3 className="text-xl font-bold text-slate-950">Check In Hari Ini</h3>
        <p className="text-sm text-slate-600">Pastikan GPS aktif dan ambil foto selfie Anda.</p>
      </div>

      {state.isOutOfRange && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left text-sm text-amber-800 flex flex-col gap-3">
          <p className="font-semibold text-amber-900">Peringatan Jangkauan:</p>
          <p>Kamu di luar jangkauan Kantor. Mohon segera mendekat ke lokasi kantor yang sudah di tentukan oleh Pengurus atau Mentor Magang.</p>
          {!confirmOut ? (
            <button
              type="button"
              onClick={() => setConfirmOut(true)}
              className="mt-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded text-xs transition self-start"
            >
              Saya Sedang Kegiatan Luar
            </button>
          ) : (
            <div className="flex flex-col gap-3 mt-2 border-t border-amber-200 pt-3">
              <p className="text-xs font-bold text-amber-950">Formulir Kegiatan Luar Kantor:</p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Alasan Kegiatan *</label>
                <textarea
                  name="outOfRangeReason"
                  required
                  rows={2}
                  className="w-full text-slate-800 p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-teal-500"
                  placeholder="Contoh: Mengikuti seminar kampus / Kunjungan industri..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Bukti Dokumen (PDF/Gambar) *</label>
                <input
                  type="file"
                  name="outOfRangeProof"
                  required
                  accept="image/*,application/pdf"
                  className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <LiveCameraInput />

      {location ? (
        <>
          <input name="latitude" type="hidden" value={location.lat} />
          <input name="longitude" type="hidden" value={location.lng} />
          <p className="text-xs text-slate-500 font-mono">Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</p>
          {(!state.isOutOfRange || confirmOut) && (
            <button className="button-primary w-full" disabled={isPending} type="submit">
              {isPending ? "Memproses..." : "Check In Sekarang"}
            </button>
          )}
        </>
      ) : error ? (
        <p className="text-sm font-semibold text-red-700">{error}</p>
      ) : (
        <p className="text-sm text-slate-500">Mengambil lokasi...</p>
      )}

      {state.message && !state.isOutOfRange && (
        <p className={`text-sm font-semibold ${state.ok ? "text-teal-700" : "text-red-700"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}


