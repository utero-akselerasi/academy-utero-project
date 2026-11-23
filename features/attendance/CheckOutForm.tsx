"use client";

import { checkOutAction, type FormState } from "@/features/attendance/actions";
import { useActionState, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { LiveCameraInput } from "./LiveCameraInput";

const initialState: FormState = { ok: false, message: "" };

export function CheckOutForm({ autoStartCamera = false, onComplete }: { autoStartCamera?: boolean; onComplete?: () => void }) {
  const [state, formAction, isPending] = useActionState(checkOutAction, initialState);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => { if (state.ok) onComplete?.(); }, [state.ok, onComplete]);

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
        <span className="rounded-full bg-amber-100 p-4 text-amber-700">
          <MapPin size={32} />
        </span>
        <h3 className="text-xl font-bold text-slate-950">Check Out Hari Ini</h3>
        <p className="text-sm text-slate-600">Simpan absensi pulang kamu hari ini dengan foto selfie.</p>
      </div>

      {state.isOutOfRange && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left text-sm text-amber-800 flex flex-col gap-3">
          <p className="font-semibold text-amber-900">Check-out di Luar Kantor</p>
          <p>Tambahkan alasan dan bukti kegiatan agar check-out masuk review mentor.</p>
          {!confirmOut ? (
            <button type="button" onClick={() => setConfirmOut(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded text-xs self-start">
              Isi Bukti Kegiatan Luar
            </button>
          ) : (
            <div className="flex flex-col gap-3 border-t border-amber-200 pt-3">
              <textarea name="outOfRangeReason" required rows={2} className="w-full text-slate-800 p-2 border border-slate-300 rounded text-xs" placeholder="Jelaskan kegiatan di luar kantor..." />
              <input type="file" name="outOfRangeProof" required accept="image/*,application/pdf" className="w-full text-xs" />
            </div>
          )}
        </div>
      )}

      <LiveCameraInput autoStart={autoStartCamera} />

      {location ? (
        <>
          <input name="latitude" type="hidden" value={location.lat} />
          <input name="longitude" type="hidden" value={location.lng} />
          {(!state.isOutOfRange || confirmOut) && (
            <button className="button-secondary w-full" disabled={isPending} type="submit">
              {isPending ? "Memproses..." : "Check Out Sekarang"}
            </button>
          )}
        </>
      ) : error ? (
        <p className="text-sm font-semibold text-red-700">{error}</p>
      ) : (
        <p className="text-sm text-slate-500">Mengambil lokasi...</p>
      )}

      {state.message && (
        <p className={`text-sm font-semibold ${state.ok ? "text-teal-700" : "text-red-700"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
