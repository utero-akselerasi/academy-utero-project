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

      <LiveCameraInput />

      {location ? (
        <>
          <input name="latitude" type="hidden" value={location.lat} />
          <input name="longitude" type="hidden" value={location.lng} />
          <p className="text-xs text-slate-500 font-mono">Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</p>
          <button className="button-primary w-full" disabled={isPending} type="submit">
            {isPending ? "Memproses..." : "Check In Sekarang"}
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
