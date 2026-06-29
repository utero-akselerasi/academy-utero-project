"use client";

import { checkOutAction, type FormState } from "@/features/attendance/actions";
import { useActionState, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { LiveCameraInput } from "./LiveCameraInput";

const initialState: FormState = { ok: false, message: "" };

export function CheckOutForm() {
  const [state, formAction, isPending] = useActionState(checkOutAction, initialState);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState("");

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

      <LiveCameraInput />

      {location ? (
        <>
          <input name="latitude" type="hidden" value={location.lat} />
          <input name="longitude" type="hidden" value={location.lng} />
          <button className="button-secondary w-full" disabled={isPending} type="submit">
            {isPending ? "Memproses..." : "Check Out Sekarang"}
          </button>
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
