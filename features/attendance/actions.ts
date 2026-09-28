"use server";

import { ATTENDANCE_SETTINGS_ID } from "./constants";
import { requireAdmin, requireUser } from "@/features/auth/guards";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { createSupabaseServerClient, createUteroAcademyClient, createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { getInternProfileId } from "@/features/daily-reports/queries";
import { UploadValidationError, buildStoragePath, validateBase64Image, validateUpload } from "@/lib/uploads";
import { jakartaDateString } from "@/lib/time";
import { revalidatePath } from "next/cache";
import { attendanceSettingsSchema, checkInSchema, checkOutSchema, reviewAttendanceSchema } from "./schemas";
import { GEOFENCE_MISCONFIGURED_MESSAGE, getDistanceMeters, resolveGeofence } from "./geofence";
import { rentangTanggalIzin } from "./permit-dates";

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

  const today = jakartaDateString();
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
    .eq("id", ATTENDANCE_SETTINGS_ID)
    .maybeSingle();

  let isOutOfRange = false;
  let outOfRangeReason = null;
  let outOfRangeProofPath = null;

  const geofenceIn = resolveGeofence(settingsIn);
  if (geofenceIn.kind === "misconfigured") {
    return { ok: false, message: GEOFENCE_MISCONFIGURED_MESSAGE };
  }

  if (geofenceIn.kind === "active") {
    const distance = getDistanceMeters(
      parsed.data.latitude,
      parsed.data.longitude,
      geofenceIn.latitude,
      geofenceIn.longitude
    );
    if (distance > geofenceIn.radiusMeters) {
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
  const today = jakartaDateString();
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
    .eq("id", ATTENDANCE_SETTINGS_ID)
    .maybeSingle();

  const geofenceOut = resolveGeofence(settingsOut);
  if (geofenceOut.kind === "misconfigured") {
    return { ok: false, message: GEOFENCE_MISCONFIGURED_MESSAGE };
  }

  if (geofenceOut.kind === "active") {
    const distance = getDistanceMeters(
      parsed.data.latitude,
      parsed.data.longitude,
      geofenceOut.latitude,
      geofenceOut.longitude
    );
    if (distance > geofenceOut.radiusMeters) {
      return {
        ok: false,
        message: "Absen ditolak. Anda berada di luar radius kantor (" + Math.round(distance) + "m > " + geofenceOut.radiusMeters + "m)."
      };
    }
  }

  const selfiePath = await uploadSelfieBase64(user.id, selfieBase64, "out");
  if (!selfiePath) return { ok: false, message: "Gagal mengunggah foto selfie." };
  const db = await createUteroAcademyClient();
  const today = jakartaDateString();
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

  /**
   * `toOptionalNumber`, bukan `parseFloat` langsung.
   *
   * Dua alasan. Pertama, `parseFloat("12abc")` mengembalikan `12` — ia
   * memotong sampah di belakang alih-alih menolaknya, jadi koordinat yang salah
   * ketik tersimpan sebagai angka yang terlihat sah. `Number()` menolak seluruh
   * string itu sebagai `NaN`, dan zod menolak `NaN`.
   *
   * Kedua, `Number("")` bernilai `0`, bukan `NaN` — jadi isian kosong harus
   * dipetakan ke `null` **sebelum** konversi. Tanpa ini, mengosongkan kolom
   * latitude akan menyimpan koordinat `0,0` (Teluk Guinea), yang membuat setiap
   * peserta terhitung di luar radius.
   */
  const toOptionalNumber = (value: FormDataEntryValue | null): number | null => {
    if (typeof value !== "string" || value.trim() === "") return null;
    return Number(value);
  };

  const parsed = attendanceSettingsSchema.safeParse({
    checkInTime: (formData.get("checkInTime") as string | null)?.trim() || "08:00",
    checkOutTime: (formData.get("checkOutTime") as string | null)?.trim() || "17:00",
    lateToleranceMinutes: toOptionalNumber(formData.get("lateTolerance")) ?? 15,
    monthlyTargetHours: toOptionalNumber(formData.get("monthlyTarget")) ?? 120,
    allowGeofencing: formData.get("allowGeofencing") === "true",
    officeLatitude: toOptionalNumber(formData.get("officeLatitude")),
    officeLongitude: toOptionalNumber(formData.get("officeLongitude")),
    radiusMeters: toOptionalNumber(formData.get("radiusMeters")) ?? 100,
  });

  if (!parsed.success) {
    // Form ini terikat langsung ke `action={...}` tanpa `useActionState`, jadi
    // nilai kembali tidak akan pernah terbaca — `throw` adalah satu-satunya
    // jalur yang sampai ke pengguna. Pesan zod disertakan supaya admin tahu
    // field mana yang salah, bukan cuma "gagal menyimpan".
    const detail = parsed.error.issues.map((issue) => issue.message).join(" ");
    throw new Error("Pengaturan absensi tidak valid. " + detail);
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("attendance_settings")
    .upsert({
      id: ATTENDANCE_SETTINGS_ID,
      check_in_time: parsed.data.checkInTime,
      check_out_time: parsed.data.checkOutTime,
      late_tolerance_minutes: parsed.data.lateToleranceMinutes,
      monthly_target_hours: parsed.data.monthlyTargetHours,
      // Koordinat disimpan apa adanya, termasuk `null`. Fallback
      // `-7.9671`/`112.6375` (Malang) yang lama dihapus: default itu tempatnya
      // di migrasi `0014`, dan menyuntikkannya dari kode aplikasi berarti
      // geofence bisa terbentuk di kota yang tidak pernah dipilih admin.
      office_latitude: parsed.data.officeLatitude,
      office_longitude: parsed.data.officeLongitude,
      allow_geofencing: parsed.data.allowGeofencing,
      radius_meters: parsed.data.radiusMeters,
      updated_at: new Date().toISOString()
    })
    .select("id");

  if (error) {
    console.error("Gagal simpan settings absensi:", error);
    throw new Error("Gagal menyimpan pengaturan absensi.");
  }

  // M-2: upsert yang tidak mengenai satu baris pun mengembalikan `error: null`.
  // Tanpa pemeriksaan ini, RLS yang menolak tulis akan tampil ke admin sebagai
  // penyimpanan yang berhasil — pengaturan geofence terlihat berubah di form
  // (karena `revalidatePath` memuat ulang) padahal DB tidak bergerak.
  if (!data || data.length === 0) {
    throw new Error("Pengaturan absensi tidak tersimpan: tidak ada baris yang terpengaruh.");
  }

  revalidatePath("/dashboard/mentor/attendance");
}


export async function reviewPermitAction(formData: FormData) {
  const user = await requireStaff();

  const permitId = formData.get("permitId") as string;
  const status = formData.get("status") as string; // 'approved' | 'rejected'
  const endDate = formData.get("endDate") as string;

  if (!permitId || !status) throw new Error("Data tidak lengkap.");

  // `status` diperiksa terhadap daftar tertutup. Dulu nilainya masuk apa adanya
  // ke kolom, jadi nilai selain approved/rejected akan tersimpan dan membuat izin
  // itu tak pernah muncul lagi di daftar mana pun — tanpa satu pun error.
  if (status !== "approved" && status !== "rejected") {
    throw new Error("Status review izin tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  // Ambil data permit
  const { data: permit } = await db.from("permits").select("*").eq("id", permitId).maybeSingle();
  if (!permit) throw new Error("Permit tidak ditemukan.");

  // Admin hanya boleh menyetujui izin intern yang dibimbingnya.
  await requireInternInScope(user.id, permit.intern_id as string | null);

  const newEndDate = endDate || permit.end_date;

  // Rentang tanggal divalidasi **sebelum** permit di-update. Urutan lama menyimpan
  // status dulu, lalu membangun absensi dari rentang yang tidak pernah diperiksa —
  // jadi rentang cacat meninggalkan izin bertanda "approved" tanpa satu pun baris
  // absensi, dan peserta tercatat alpa untuk hari yang izinnya sudah disetujui.
  // Lihat `./permit-dates.ts` untuk empat cara rentang itu bisa cacat tanpa suara.
  let tanggalIzin: string[] = [];
  if (status === "approved") {
    const rentang = rentangTanggalIzin(permit.start_date, newEndDate);
    if (!rentang.ok) {
      throw new Error(rentang.message);
    }
    tanggalIzin = rentang.tanggal;
  }

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

  if (status === "approved") {
    const reviewedAt = new Date().toISOString();
    const inserts = tanggalIzin.map((dateStr) => ({
      intern_id: permit.intern_id,
      attendance_date: dateStr,
      attendance_type: permit.permit_type,
      permit_reason: permit.reason,
      sick_certificate_path: permit.attachment_path,
      status: "valid",
      reviewed_by: user.id,
      reviewed_at: reviewedAt
    }));

    // `upsert` menangani bentrok kalau peserta sudah punya baris absensi hari itu
    // (mis. check-in yang masih pending).
    const { error: insertError } = await db.from("attendances").upsert(inserts, {
      onConflict: "intern_id, attendance_date"
    });

    // Dilempar, tidak cuma di-log. Bentuk lama menelan error ini, jadi izin
    // tersimpan "approved" sementara absensinya tidak pernah ada — dan admin
    // melihat halaman yang berhasil dimuat ulang sebagai konfirmasi.
    if (insertError) {
      console.error("Gagal buat absen dari permit:", insertError);
      throw new Error("Izin disetujui, namun gagal membuat catatan absensinya. Coba lagi.");
    }
  }

  revalidatePath("/dashboard/mentor/attendance");
}
