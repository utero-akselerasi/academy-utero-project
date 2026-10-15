import { backendRequest } from "@/lib/backend/server";
import { validateBase64Image, validateUpload } from "@/lib/uploads";
import { UploadValidationError } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { attendanceSettingsSchema, checkInSchema, checkOutSchema, reviewAttendanceSchema } from "./schemas";
import { type FormState } from "./actions";
import { type Attendance, type AttendanceWithIntern } from "./types";

export type MentorAttendanceDashboard = {
  setupRequired: boolean;
  settings: Record<string, any> | null;
  interns: Record<string, any>[];
  attendances: Attendance[];
  pendingPermits: Record<string, any>[];
};

export type AttendanceExportData = {
  settings: { check_in_time?: string | null; late_tolerance_minutes?: number | null; monthly_target_hours?: number | null } | null;
  interns: Array<{ id: string; full_name: string; email: string | null; major: string | null; phone: string | null }>;
  attendances: Array<Pick<Attendance, "intern_id" | "attendance_date" | "check_in_at" | "check_out_at" | "status" | "attendance_type">>;
};

async function send(path: string, method: string, body: unknown) {
  const response = await backendRequest(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { response, data: await response.json() as Record<string, any> };
}

function upload(file: File) {
  return validateUpload(file, ["image", "document"]).then((value) => ({
    dataUrl: `data:${value.contentType};base64,${Buffer.from(value.buffer).toString("base64")}`,
    fileName: value.displayName,
  }));
}

export async function localCheckIn(formData: FormData): Promise<FormState> {
  const parsed = checkInSchema.safeParse({ latitude: Number(formData.get("latitude")), longitude: Number(formData.get("longitude")), wifiSsid: formData.get("wifiSsid") || undefined });
  if (!parsed.success) return { ok: false, message: "Format koordinat lokasi tidak valid." };
  try {
    const selfie = validateBase64Image(String(formData.get("selfieBase64") || ""));
    const proof = formData.get("outOfRangeProof");
    const outOfRangeProof = proof instanceof File && proof.size ? await upload(proof) : undefined;
    const { response, data } = await send("/v1/attendance/check-in", "POST", {
      ...parsed.data, selfieDataUrl: `data:${selfie.contentType};base64,${Buffer.from(selfie.buffer).toString("base64")}`,
      outOfRangeReason: formData.get("outOfRangeReason"), outOfRangeProof,
    });
    if (!response.ok) return { ok: false, message: data.error === "out_of_range_proof_required" ? "Kamu di luar jangkauan kantor. Isi alasan dan unggah bukti.": "Gagal check-in, periksa lokasi dan lampiran.", isOutOfRange: data.error === "out_of_range_proof_required" };
    revalidatePath("/dashboard/intern/attendance");
    return { ok: true, message: "Check-in berhasil disimpan." };
  } catch (error) {
    return { ok: false, message: error instanceof UploadValidationError ? error.message : "Gagal memproses check-in." };
  }
}

export async function localCheckOut(formData: FormData): Promise<FormState> {
  const parsed = checkOutSchema.safeParse({ latitude: Number(formData.get("latitude")), longitude: Number(formData.get("longitude")), wifiSsid: formData.get("wifiSsid") || undefined });
  if (!parsed.success) return { ok: false, message: "Format koordinat lokasi tidak valid." };
  try {
    const selfie = validateBase64Image(String(formData.get("selfieBase64") || ""));
    const { response, data } = await send("/v1/attendance/check-out", "POST", {
      ...parsed.data, selfieDataUrl: `data:${selfie.contentType};base64,${Buffer.from(selfie.buffer).toString("base64")}`,
    });
    if (!response.ok) return { ok: false, message: data.error === "outside_geofence" ? "Absen ditolak. Lokasi di luar radius kantor." : "Gagal check-out. Pastikan sudah check-in." };
    revalidatePath("/dashboard/intern/attendance");
    return { ok: true, message: "Check-out berhasil disimpan." };
  } catch (error) { return { ok: false, message: error instanceof UploadValidationError ? error.message : "Gagal memproses check-out." }; }
}

export async function localPermit(formData: FormData): Promise<FormState> {
  const file = formData.get("certificate");
  try {
    const { response } = await send("/v1/attendance/permits", "POST", {
      permitType: formData.get("permitType"), startDate: formData.get("startDate"), endDate: formData.get("endDate"),
      reason: formData.get("reason"), certificate: file instanceof File && file.size ? await upload(file) : undefined,
    });
    if (!response.ok) return { ok: false, message: "Pengajuan izin gagal. Periksa tanggal, alasan, dan surat dokter." };
    revalidatePath("/dashboard/intern/attendance");
    return { ok: true, message: "Pengajuan izin/sakit berhasil dikirim." };
  } catch (error) { return { ok: false, message: error instanceof UploadValidationError ? error.message : "Gagal memproses lampiran." }; }
}

export async function localReview(formData: FormData) {
  const parsed = reviewAttendanceSchema.safeParse({ attendanceId: formData.get("attendanceId"), status: formData.get("status"), note: formData.get("note") });
  if (!parsed.success) throw new Error("Data review absensi tidak valid.");
  const { response } = await send(`/v1/attendance/${parsed.data.attendanceId}/review`, "PATCH", parsed.data);
  if (!response.ok) throw new Error("Gagal review absensi.");
  revalidatePath("/dashboard/mentor/attendance");
}

export async function localReviewPermit(formData: FormData) {
  const id = formData.get("permitId");
  const status = formData.get("status");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || !["approved", "rejected"].includes(String(status))) throw new Error("Data review izin tidak valid.");
  const { response } = await send(`/v1/attendance/permits/${id}/review`, "PATCH", { status, endDate: formData.get("endDate") || undefined });
  if (!response.ok) throw new Error("Gagal review izin.");
  revalidatePath("/dashboard/mentor/attendance");
}

export async function localSettings(formData: FormData) {
  const toOptional = (value: FormDataEntryValue | null) => typeof value !== "string" || !value.trim() ? null : Number(value);
  const parsed = attendanceSettingsSchema.safeParse({
    checkInTime: String(formData.get("checkInTime") || "08:00"), checkOutTime: String(formData.get("checkOutTime") || "17:00"),
    lateToleranceMinutes: toOptional(formData.get("lateTolerance")) ?? 15,
    monthlyTargetHours: toOptional(formData.get("monthlyTarget")) ?? 120,
    allowGeofencing: formData.get("allowGeofencing") === "true", officeLatitude: toOptional(formData.get("officeLatitude")),
    officeLongitude: toOptional(formData.get("officeLongitude")), radiusMeters: toOptional(formData.get("radiusMeters")) ?? 100,
  });
  if (!parsed.success) throw new Error("Pengaturan absensi tidak valid. " + parsed.error.issues.map((item) => item.message).join(" "));
  const { response } = await send("/v1/attendance/settings", "PATCH", parsed.data);
  if (!response.ok) throw new Error("Gagal menyimpan pengaturan absensi.");
  revalidatePath("/dashboard/mentor/attendance");
}

export async function localAttendanceList(internId?: string): Promise<AttendanceWithIntern[]> {
  const response = await backendRequest(internId ? `/v1/attendance?internId=${encodeURIComponent(internId)}` : "/v1/attendance");
  if (!response.ok) throw new Error("Gagal membaca absensi lokal.");
  return ((await response.json()) as { attendances: AttendanceWithIntern[] }).attendances;
}

export async function localTodayAttendance(): Promise<Attendance | null> {
  const response = await backendRequest("/v1/attendance/today");
  if (!response.ok) throw new Error("Gagal membaca absensi hari ini.");
  return ((await response.json()) as { attendance: Attendance | null }).attendance;
}

export async function localMentorAttendanceDashboard(): Promise<MentorAttendanceDashboard> {
  const response = await backendRequest("/v1/attendance/mentor-dashboard");
  if (!response.ok) throw new Error("Gagal membaca dashboard absensi lokal.");
  return response.json() as Promise<MentorAttendanceDashboard>;
}

export async function localAttendanceExportData(startDate: string, endDate: string, mode: string): Promise<AttendanceExportData> {
  const query = new URLSearchParams({ startDate, endDate, mode });
  const response = await backendRequest(`/v1/attendance/export-data?${query}`);
  if (!response.ok) throw new Error(response.status === 403 ? "Profil pembimbing belum disiapkan." : "Gagal memuat data export absensi.");
  return response.json() as Promise<AttendanceExportData>;
}
