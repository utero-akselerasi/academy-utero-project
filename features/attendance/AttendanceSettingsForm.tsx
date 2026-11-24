"use client";

import { useState, useTransition, type FormEvent } from "react";
import { getMonthlyAttendanceTarget } from "@/lib/attendance-calendar";
import { saveAttendanceSettingsAction } from "./actions";
import { attendanceSettingsSchema } from "./schemas";

type Props = { settings: Record<string, unknown> | null; month: string };
type Fields = {
  checkInTime: string; checkOutTime: string; lateToleranceMinutes: string;
  allowGeofencing: boolean; officeLatitude: string; officeLongitude: string; radiusMeters: string;
};
type FieldName = keyof Fields;
type Errors = Partial<Record<FieldName, string>>;
const fieldIds: Record<FieldName, string> = {
  checkInTime: "attendance-check-in", checkOutTime: "attendance-check-out", lateToleranceMinutes: "attendance-tolerance",
  allowGeofencing: "attendance-geofence", officeLatitude: "attendance-latitude", officeLongitude: "attendance-longitude", radiusMeters: "attendance-radius",
};
const labelClass = "mb-1 block text-sm font-semibold text-slate-800";
const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";

function initialFields(settings: Props["settings"]): Fields {
  const value = (key: string, fallback: string) => settings?.[key] == null ? fallback : String(settings[key]);
  return {
    checkInTime: value("check_in_time", "08:00").slice(0, 5), checkOutTime: value("check_out_time", "17:00").slice(0, 5),
    lateToleranceMinutes: value("late_tolerance_minutes", "15"), allowGeofencing: settings?.allow_geofencing === true,
    officeLatitude: value("office_latitude", ""), officeLongitude: value("office_longitude", ""), radiusMeters: value("radius_meters", "100"),
  };
}

export function AttendanceSettingsForm({ settings, month }: Props) {
  const [fields, setFields] = useState(() => initialFields(settings));
  const [previewMonth, setPreviewMonth] = useState(month);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(previewMonth) ? previewMonth : month;
  const target = getMonthlyAttendanceTarget(selectedMonth);
  const [previewYear, previewMonthNumber] = selectedMonth.split("-").map(Number);
  const calendarDays = new Date(Date.UTC(previewYear, previewMonthNumber, 0)).getUTCDate();

  function update<K extends FieldName>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const parsed = attendanceSettingsSchema.safeParse({
      checkInTime: fields.checkInTime, checkOutTime: fields.checkOutTime,
      lateToleranceMinutes: fields.lateToleranceMinutes.trim() ? Number(fields.lateToleranceMinutes) : Number.NaN, monthlyTargetHours: getMonthlyAttendanceTarget(month).hours,
      allowGeofencing: fields.allowGeofencing,
      officeLatitude: fields.officeLatitude.trim() ? Number(fields.officeLatitude) : null,
      officeLongitude: fields.officeLongitude.trim() ? Number(fields.officeLongitude) : null,
      radiusMeters: fields.radiusMeters.trim() ? Number(fields.radiusMeters) : Number.NaN,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const name = issue.path[0] as FieldName;
        next[name] ??= issue.message;
      }
      setErrors(next);
      document.getElementById(fieldIds[Object.keys(next)[0] as FieldName])?.focus();
      return;
    }

    const data = new FormData();
    data.set("checkInTime", parsed.data.checkInTime);
    data.set("checkOutTime", parsed.data.checkOutTime);
    data.set("lateTolerance", String(parsed.data.lateToleranceMinutes));
    data.set("monthlyTarget", String(parsed.data.monthlyTargetHours));
    data.set("allowGeofencing", String(parsed.data.allowGeofencing));
    data.set("officeLatitude", parsed.data.officeLatitude === null ? "" : String(parsed.data.officeLatitude));
    data.set("officeLongitude", parsed.data.officeLongitude === null ? "" : String(parsed.data.officeLongitude));
    data.set("radiusMeters", String(parsed.data.radiusMeters));
    startTransition(async () => {
      try {
        await saveAttendanceSettingsAction(data);
        setMessage("Pengaturan absensi berhasil disimpan.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Pengaturan gagal disimpan. Coba lagi.");
      }
    });
  }

  const fieldError = (name: FieldName) => errors[name] ? <p id={`${fieldIds[name]}-error`} className="mt-1 text-sm text-red-700">{errors[name]}</p> : null;
  return <form onSubmit={submit} noValidate className="space-y-5" aria-busy={isPending}>
    <section aria-labelledby="attendance-schedule-title" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id="attendance-schedule-title" className="text-base font-bold text-slate-950">Jadwal &amp; target</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label className={labelClass} htmlFor={fieldIds.checkInTime}>Jam masuk</label><input id={fieldIds.checkInTime} type="time" required value={fields.checkInTime} onChange={(e) => update("checkInTime", e.target.value)} aria-invalid={Boolean(errors.checkInTime)} aria-describedby={errors.checkInTime ? `${fieldIds.checkInTime}-error` : undefined} className={inputClass} />{fieldError("checkInTime")}</div>
        <div><label className={labelClass} htmlFor={fieldIds.checkOutTime}>Jam pulang</label><input id={fieldIds.checkOutTime} type="time" required value={fields.checkOutTime} onChange={(e) => update("checkOutTime", e.target.value)} aria-invalid={Boolean(errors.checkOutTime)} aria-describedby={errors.checkOutTime ? `${fieldIds.checkOutTime}-error` : undefined} className={inputClass} />{fieldError("checkOutTime")}</div>
        <div><label className={labelClass} htmlFor={fieldIds.lateToleranceMinutes}>Toleransi keterlambatan (menit)</label><input id={fieldIds.lateToleranceMinutes} type="number" min="0" max="180" step="1" required value={fields.lateToleranceMinutes} onChange={(e) => update("lateToleranceMinutes", e.target.value)} aria-invalid={Boolean(errors.lateToleranceMinutes)} aria-describedby={errors.lateToleranceMinutes ? `${fieldIds.lateToleranceMinutes}-error` : "attendance-tolerance-hint"} className={inputClass} /><p id="attendance-tolerance-hint" className="mt-1 text-sm text-slate-600">Maksimal 180 menit.</p>{fieldError("lateToleranceMinutes")}</div>
        <div className="rounded-lg bg-teal-50 p-3"><label className="block text-sm font-semibold text-teal-950" htmlFor="attendance-target-month">Pratinjau target bulan</label><input id="attendance-target-month" type="month" min="0100-01" value={previewMonth} onChange={(event) => setPreviewMonth(event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-teal-200 bg-white px-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" /><div aria-live="polite"><p className="mt-2 text-2xl font-bold tabular-nums text-teal-900">{target.hours} jam</p><p className="text-sm text-teal-900">{calendarDays} hari kalender − {calendarDays - target.workdays} Minggu = {target.workdays} hari kerja × 8 jam.</p><p className="mt-1 text-xs text-teal-900">Senin–Sabtu; target tiap peserta disesuaikan tanggal aktif. Libur nasional belum dikurangi.</p></div></div>
      </div>
    </section>

    <section aria-labelledby="attendance-location-title" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id="attendance-location-title" className="text-base font-bold text-slate-950">Lokasi &amp; GPS</h2>
      <div className="mt-4">
        <div className="flex min-h-11 items-center gap-3"><input id={fieldIds.allowGeofencing} type="checkbox" checked={fields.allowGeofencing} onChange={(e) => update("allowGeofencing", e.target.checked)} aria-describedby="attendance-geofence-hint" className="size-5 rounded border-slate-400 text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" /><label htmlFor={fieldIds.allowGeofencing} className="font-semibold text-slate-800">Aktifkan pembatasan GPS</label></div>
        <p id="attendance-geofence-hint" className="text-sm text-slate-600">Koordinat yang disimpan tetap dipertahankan saat GPS dimatikan.</p>{fieldError("allowGeofencing")}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label className={labelClass} htmlFor={fieldIds.officeLatitude}>Latitude kantor</label><input id={fieldIds.officeLatitude} type="number" min="-90" max="90" step="any" inputMode="decimal" value={fields.officeLatitude} onChange={(e) => update("officeLatitude", e.target.value)} aria-required={fields.allowGeofencing} aria-invalid={Boolean(errors.officeLatitude)} aria-describedby={errors.officeLatitude ? `${fieldIds.officeLatitude}-error` : undefined} className={inputClass} />{fieldError("officeLatitude")}</div>
        <div><label className={labelClass} htmlFor={fieldIds.officeLongitude}>Longitude kantor</label><input id={fieldIds.officeLongitude} type="number" min="-180" max="180" step="any" inputMode="decimal" value={fields.officeLongitude} onChange={(e) => update("officeLongitude", e.target.value)} aria-required={fields.allowGeofencing} aria-invalid={Boolean(errors.officeLongitude)} aria-describedby={errors.officeLongitude ? `${fieldIds.officeLongitude}-error` : undefined} className={inputClass} />{fieldError("officeLongitude")}</div>
        <div><label className={labelClass} htmlFor={fieldIds.radiusMeters}>Radius geofence (meter)</label><input id={fieldIds.radiusMeters} type="number" min="0" max="100000" step="1" required value={fields.radiusMeters} onChange={(e) => update("radiusMeters", e.target.value)} aria-invalid={Boolean(errors.radiusMeters)} aria-describedby={errors.radiusMeters ? `${fieldIds.radiusMeters}-error` : "attendance-radius-hint"} className={inputClass} /><p id="attendance-radius-hint" className="mt-1 text-sm text-slate-600">0 meter berarti hanya titik koordinat kantor.</p>{fieldError("radiusMeters")}</div>
      </div>
    </section>

    <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={isPending} className="min-h-11 rounded-lg bg-teal-800 px-5 py-2 font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-wait disabled:opacity-60">{isPending ? "Menyimpan…" : "Simpan pengaturan"}</button>{message && <p role={message.includes("berhasil") ? "status" : "alert"} aria-live={message.includes("berhasil") ? "polite" : "assertive"} className={`text-sm font-semibold ${message.includes("berhasil") ? "text-teal-800" : "text-red-700"}`}>{message}</p>}</div>
  </form>;
}
