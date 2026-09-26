"use server";

import { requireAdmin, requireUser } from "@/features/auth/guards";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { createSupabaseServerClient, createUteroAcademyClient, createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { UploadValidationError, buildStoragePath, validateBase64Image, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";
import { checkInSchema, checkOutSchema, reviewAttendanceSchema } from "./schemas";

/**
 * Aksi review/pengaturan absensi hanya untuk staff.
 * Guard lama cuma cek sesi, sehingga peserta bisa memanggil langsung lewat
 * action ID dan menyetujui absensinya sendiri atau mengubah geofencing.
 */
const requireStaff = requireAdmin;

/** Admin hanya boleh mereview intern yang dibimbingnya; super_admin bebas. */
async function requireInternInScope(userId: string, internId: string | null) {
  const scope = await resolveStaffInternScope(userId);

  if (scope.kind === "global") return;
  if (scope.kind === "setup_required") {
    throw new Error("Profil pembimbing belum disiapkan. Hubungi super admin.");
  }
  if (!internId || !scope.internIds.includes(internId)) {
    throw new Error("Kamu tidak membimbing peserta ini.");
  }
}

function getTodayDateLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type FormState = {
  ok: boolean;
  message: string;
  isOutOfRange?: boolean;
};

/**
 * Selfie absensi diunggah dengan service role setelah divalidasi dari isinya.
 * Sebelumnya fungsi ini menerima `supabase: any` milik sesi dan memaksa
 * contentType "image/jpeg" atas data base64 apa pun, jadi berkas non-gambar
 * (mis. HTML) bisa masuk bucket publik, dan tidak ada batas ukuran.
 */
async function uploadSelfieBase64(userId: string, base64Data: string, type: 'in' | 'out'): Promise<string | null> {
  let selfie;
  try {
    selfie = validateBase64Image(base64Data);
  } catch (error) {
    if (error instanceof UploadValidationError) {
      console.error("Selfie absensi ditolak:", error.message);
    } else {
      console.error("Gagal memvalidasi selfie absensi:", error);
    }
    return null;
  }

  const today = getTodayDateLocal();
  const supabase = createSupabaseServiceRoleClient();
  const filePath = buildStoragePath(`${userId}/attendance_${today}_${type}`, selfie.ext);
  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, selfie.buffer, { contentType: selfie.contentType, upsert: false });
  if (error) {
    console.error("Gagal upload selfie base64:", error);
    return null;
  }
  // Object path, BUKAN URL publik. Bucket `avatars` jadi privat (0032b), dan
  // pembacaannya lewat `resolveStorageUrl()` yang menandatangani di server.
  return filePath;
}

export async function checkInAction(_: FormState, formData: FormData): Promise<FormState> {
  // Aksi peserta: kepemilikan ditentukan lewat intern_profiles.user_id.
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const internId = await getInternProfileId(user.id);
  if (!internId) return { ok: false, message: "Profil peserta tidak ditemukan." };
  const latStr = formData.get("latitude");
  const lngStr = formData.get("longitude");
  const selfieBase64 = formData.get("selfieBase64") as string;
  if (!latStr || !lngStr) return { ok: false, message: "Akses lokasi diperlukan untuk check-in." };
  if (!selfieBase64) return { ok: false, message: "Foto selfie wajib diambil." };
  const parsed = checkInSchema.safeParse({ latitude: Number(latStr), longitude: Number(lngStr), wifiSsid: formData.get("wifiSsid") || undefined });
  if (!parsed.success) return { ok: false, message: "Format koordinat lokasi tidak valid." };

  // Geofencing Check
  const dbSrvIn = await createUteroAcademyServiceRoleClient();
  const { data: settingsIn } = await dbSrvIn
    .from("attendance_settings")
    .select("office_latitude, office_longitude, allow_geofencing, radius_meters")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

  let isOutOfRange = false;
  let outOfRangeReason = null;
  let outOfRangeProofPath = null;

  if (settingsIn?.allow_geofencing) {
    const distance = getDistanceMeters(
      parsed.data.latitude,
      parsed.data.longitude,
      settingsIn.office_latitude || -7.9671,
      settingsIn.office_longitude || 112.6375
    );
    if (distance > (settingsIn.radius_meters || 100)) {
      isOutOfRange = true;
      const reason = formData.get("outOfRangeReason") as string | null;
      const proofFile = formData.get("outOfRangeProof") as File | null;
      
      if (!reason || reason.trim().length < 5) {
        return { 
          ok: false, 
          message: "Kamu di luar jangkauan Kantor. Mohon konfirmasi kegiatan luar jika ada.",
          isOutOfRange: true
        };
      }
      
      if (!proofFile || proofFile.size === 0) {
        return { 
          ok: false, 
          message: "Dokumen bukti kegiatan luar wajib diunggah.",
          isOutOfRange: true
        };
      }
      
      // Tipe & ekstensi ditentukan dari isi berkas, bukan dari klien.
      let proof;
      try {
        proof = await validateUpload(proofFile, ["image", "document"]);
      } catch (error) {
        if (error instanceof UploadValidationError) {
          return { ok: false, message: error.message, isOutOfRange: true };
        }
        console.error("Gagal memvalidasi bukti kegiatan luar:", error);
        return { ok: false, message: "Dokumen bukti tidak dapat diproses.", isOutOfRange: true };
      }

      const serviceClient = createSupabaseServiceRoleClient();
      const filePath = buildStoragePath(`${user.id}/proof`, proof.ext);
      const { error: uploadError } = await serviceClient.storage
        .from("avatars")
        .upload(filePath, proof.buffer, { contentType: proof.contentType, upsert: false });

      if (uploadError) {
        return { ok: false, message: "Gagal mengunggah dokumen bukti kegiatan luar." };
      }
      // Object path, bukan URL — lihat catatan di uploadSelfieBase64.
      outOfRangeProofPath = filePath;
      outOfRangeReason = reason;
    }
  }

  const selfiePath = await uploadSelfieBase64(user.id, selfieBase64, "in");
  if (!selfiePath) return { ok: false, message: "Gagal mengunggah foto selfie." };
  const db = await createUteroAcademyClient();
  const today = getTodayDateLocal();
  const { error } = await db.from("attendances").insert({ 
    intern_id: internId, 
    attendance_date: today, 
    check_in_at: new Date().toISOString(), 
    check_in_latitude: parsed.data.latitude, 
    check_in_longitude: parsed.data.longitude, 
    check_in_wifi_ssid: parsed.data.wifiSsid || null, 
    check_in_selfie_path: selfiePath, 
    status: isOutOfRange ? "manual_review" : "pending",
    is_out_of_range: isOutOfRange,
    out_of_range_reason: outOfRangeReason,
    out_of_range_proof_path: outOfRangeProofPath
  });
  if (error) {
    console.error("Gagal check-in:", error);
    return { ok: false, message: "Gagal check-in, mungkin sudah check-in hari ini." };
  }
  revalidatePath("/dashboard/intern/attendance");
  return { ok: true, message: "Check-in berhasil disimpan." };
}

export async function checkOutAction(_: FormState, formData: FormData): Promise<FormState> {
  // Aksi peserta: kepemilikan ditentukan lewat intern_profiles.user_id.
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const internId = await getInternProfileId(user.id);
  if (!internId) return { ok: false, message: "Profil peserta tidak ditemukan." };
  const latStr = formData.get("latitude");
  const lngStr = formData.get("longitude");
  const selfieBase64 = formData.get("selfieBase64") as string;
  if (!latStr || !lngStr) return { ok: false, message: "Akses lokasi diperlukan untuk check-out." };
  if (!selfieBase64) return { ok: false, message: "Foto selfie wajib diambil." };
  const parsed = checkOutSchema.safeParse({ latitude: Number(latStr), longitude: Number(lngStr), wifiSsid: formData.get("wifiSsid") || undefined });
  if (!parsed.success) return { ok: false, message: "Format koordinat lokasi tidak valid." };

  // Geofencing Check
  const dbSrvOut = await createUteroAcademyServiceRoleClient();
  const { data: settingsOut } = await dbSrvOut
    .from("attendance_settings")
    .select("office_latitude, office_longitude, allow_geofencing, radius_meters")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .maybeSingle();

  if (settingsOut?.allow_geofencing) {
    const distance = getDistanceMeters(
      parsed.data.latitude,
      parsed.data.longitude,
      settingsOut.office_latitude || -7.9671,
      settingsOut.office_longitude || 112.6375
    );
    if (distance > (settingsOut.radius_meters || 100)) {
      return { 
        ok: false, 
        message: "Absen ditolak. Anda berada di luar radius kantor (" + Math.round(distance) + "m > " + (settingsOut.radius_meters || 100) + "m)." 
      };
    }
  }

  const selfiePath = await uploadSelfieBase64(user.id, selfieBase64, "out");
  if (!selfiePath) return { ok: false, message: "Gagal mengunggah foto selfie." };
  const db = await createUteroAcademyClient();
  const today = getTodayDateLocal();
  const { error } = await db.from("attendances").update({ check_out_at: new Date().toISOString(), check_out_latitude: parsed.data.latitude, check_out_longitude: parsed.data.longitude, check_out_wifi_ssid: parsed.data.wifiSsid || null, check_out_selfie_path: selfiePath, updated_at: new Date().toISOString() }).eq("intern_id", internId).eq("attendance_date", today);
  if (error) {
    console.log("Gagal check-out:", error);
    return { ok: false, message: "Gagal check-out. Harap check-in terlebih dahulu." };
  }
  revalidatePath("/dashboard/intern/attendance");
  return { ok: true, message: "Check-out berhasil disimpan." };
}

export async function reviewAttendanceAction(formData: FormData) {
  const user = await requireStaff();
  const parsed = reviewAttendanceSchema.safeParse({ attendanceId: formData.get("attendanceId"), status: formData.get("status"), note: formData.get("note") });
  if (!parsed.success) throw new Error("Data review absensi tidak valid.");

  // Pastikan baris absensi memang milik intern yang dibimbing user ini.
  const lookup = await createUteroAcademyServiceRoleClient();
  const { data: row, error: rowError } = await lookup
    .from("attendances")
    .select("id, intern_id")
    .eq("id", parsed.data.attendanceId)
    .maybeSingle();

  if (rowError) {
    console.error("Gagal membaca absensi:", rowError);
    throw new Error("Gagal memverifikasi data absensi.");
  }
  if (!row) throw new Error("Data absensi tidak ditemukan.");

  await requireInternInScope(user.id, row.intern_id as string | null);

  const db = await createUteroAcademyClient();
  const { error } = await db.from("attendances").update({ status: parsed.data.status, review_note: parsed.data.note || null, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", parsed.data.attendanceId);
  if (error) {
    console.error("Gagal review absensi:", error);
    throw new Error("Gagal review absensi.");
  }
  revalidatePath("/dashboard/mentor/attendance");
}

export async function submitPermitAction(_: FormState, formData: FormData): Promise<FormState> {
  // Aksi peserta: kepemilikan ditentukan lewat intern_profiles.user_id.
  const user = await requireUser();

  const internId = await getInternProfileId(user.id);
  if (!internId) return { ok: false, message: "Profil peserta tidak ditemukan." };

  const permitType = formData.get("permitType") as string;
  const reason = formData.get("reason") as string;
  const file = formData.get("certificate") as File | null;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  if (!permitType || !['permit', 'sick'].includes(permitType)) {
    return { ok: false, message: "Tipe izin tidak valid." };
  }
  
  if (!startDate || !endDate) {
    return { ok: false, message: "Tanggal mulai dan selesai wajib diisi." };
  }

  if (!reason || reason.trim().length < 5) {
    return { ok: false, message: "Alasan wajib diisi minimal 5 karakter." };
  }

  let certificatePath = null;
  if (permitType === "sick") {
    if (!file || file.size === 0) {
      return { ok: false, message: "Keterangan Surat Dokter wajib diunggah untuk status Sakit." };
    }

    // Surat dokter: tipe & ekstensi dari isi berkas, bukan dari klien.
    let certificate;
    try {
      certificate = await validateUpload(file, ["image", "document"]);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return { ok: false, message: error.message };
      }
      console.error("Gagal memvalidasi surat dokter:", error);
      return { ok: false, message: "Surat dokter tidak dapat diproses." };
    }

    const serviceClient = createSupabaseServiceRoleClient();
    const filePath = buildStoragePath(`${user.id}/sick_cert`, certificate.ext);

    const { error: uploadError } = await serviceClient.storage
      .from("avatars")
      .upload(filePath, certificate.buffer, {
        contentType: certificate.contentType,
        upsert: false
      });

    if (uploadError) {
      console.error("Gagal upload surat sakit:", uploadError);
      return { ok: false, message: "Gagal mengunggah surat dokter. Silakan coba lagi." };
    }

    // Object path, bukan URL — lihat catatan di uploadSelfieBase64. Surat dokter
    // adalah data kesehatan; ia TIDAK boleh terbaca lewat URL publik.
    certificatePath = filePath;
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { error } = await db.from("permits").insert({
    intern_id: internId,
    permit_type: permitType,
    start_date: startDate,
    end_date: endDate,
    reason: reason,
    attachment_path: certificatePath,
    status: "pending"
  });

  if (error) {
    console.error("Gagal kirim izin:", error);
    return { ok: false, message: "Pengajuan izin gagal diproses. Silakan coba lagi." };
  }

  revalidatePath("/dashboard/intern/attendance");
  return { ok: true, message: "Pengajuan izin/sakit berhasil dikirim." };
}


export async function saveAttendanceSettingsAction(formData: FormData) {
  // Pengaturan global absensi (jam kerja + geofencing) hanya boleh diubah staff.
  await requireStaff();

  const checkInTime = formData.get("checkInTime") as string;
  const checkOutTime = formData.get("checkOutTime") as string;
  const lateTolerance = formData.get("lateTolerance") as string;
  const monthlyTarget = formData.get("monthlyTarget") as string;
  const officeLatitude = formData.get("officeLatitude") as string;
  const officeLongitude = formData.get("officeLongitude") as string;
  const allowGeofencing = formData.get("allowGeofencing") === "true";
  const radiusMeters = formData.get("radiusMeters") as string;

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("attendance_settings").upsert({
    id: "00000000-0000-0000-0000-000000000001",
    check_in_time: checkInTime || "08:00",
    check_out_time: checkOutTime || "17:00",
    late_tolerance_minutes: lateTolerance ? parseInt(lateTolerance) : 15,
    monthly_target_hours: monthlyTarget ? parseInt(monthlyTarget) : 120,
    office_latitude: officeLatitude ? parseFloat(officeLatitude) : -7.9671,
    office_longitude: officeLongitude ? parseFloat(officeLongitude) : 112.6375,
    allow_geofencing: allowGeofencing,
    radius_meters: radiusMeters ? parseInt(radiusMeters) : 100,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.error("Gagal simpan settings absensi:", error);
    throw new Error("Gagal menyimpan pengaturan absensi.");
  }

  revalidatePath("/dashboard/mentor/attendance");
}


export async function reviewPermitAction(formData: FormData) {
  const user = await requireStaff();

  const permitId = formData.get("permitId") as string;
  const status = formData.get("status") as string; // 'approved' | 'rejected'
  const endDate = formData.get("endDate") as string;

  if (!permitId || !status) throw new Error("Data tidak lengkap.");

  const db = await createUteroAcademyServiceRoleClient();

  // Ambil data permit
  const { data: permit } = await db.from("permits").select("*").eq("id", permitId).maybeSingle();
  if (!permit) throw new Error("Permit tidak ditemukan.");

  // Admin hanya boleh menyetujui izin intern yang dibimbingnya.
  await requireInternInScope(user.id, permit.intern_id as string | null);

  // Update permit status and optionally endDate
  const newEndDate = endDate || permit.end_date;
  const { error: permitError } = await db.from("permits").update({
    status: status,
    end_date: newEndDate,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", permitId);

  if (permitError) {
    console.error("Gagal review permit:", permitError);
    throw new Error("Gagal menyimpan review izin.");
  }

  // Generate attendances if approved
  if (status === "approved") {
    let current = new Date(permit.start_date);
    const end = new Date(newEndDate);
    const inserts = [];
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      inserts.push({
        intern_id: permit.intern_id,
        attendance_date: dateStr,
        attendance_type: permit.permit_type,
        permit_reason: permit.reason,
        sick_certificate_path: permit.attachment_path,
        status: "valid",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      });
      current.setDate(current.getDate() + 1);
    }

    if (inserts.length > 0) {
      // Upsert to handle conflict if intern already had an attendance row that day (e.g. pending check-in)
      const { error: insertError } = await db.from("attendances").upsert(inserts, {
        onConflict: "intern_id, attendance_date"
      });
      if (insertError) {
        console.error("Gagal buat absen dari permit:", insertError);
      }
    }
  }

  revalidatePath("/dashboard/mentor/attendance");
}
