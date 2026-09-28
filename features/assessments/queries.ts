import { ATTENDANCE_SETTINGS_ID } from "@/features/attendance/constants";
import { resolveStorageUrl } from "@/lib/storage-urls";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

/**
 * Daftar peserta untuk halaman penilaian staf.
 *
 * `allowedInternIds` adalah scope pemanggil: null berarti global (super_admin),
 * array berarti hanya intern tersebut. Sebelumnya fungsi ini selalu
 * mengembalikan seluruh intern aktif, sehingga admin melihat (dan bisa menilai)
 * peserta di luar bimbingannya.
 */
export async function getInternsForAssessment(allowedInternIds: string[] | null) {
  const db = await createUteroAcademyServiceRoleClient();

  if (allowedInternIds !== null && allowedInternIds.length === 0) {
    return { data: [], error: null };
  }

  // Fetch user ids having role 'intern'
  const { data: internRoleUsers } = await db
    .from("user_roles")
    .select("user_id, roles(code)")
    .returns<any[]>();

  const internUserIds = (internRoleUsers || [])
    .filter(ur => {
      const roleObj = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
      return roleObj?.code === "intern";
    })
    .map(ur => ur.user_id);

  // Ambil anak magang aktif dalam scope pemanggil
  let internQuery = db
    .from("intern_profiles")
    .select("id, full_name, email, major, status, user_id")
    .eq("status", "active")
    .in("user_id", internUserIds.length > 0 ? internUserIds : ["00000000-0000-0000-0000-000000000000"]);

  if (allowedInternIds !== null) {
    internQuery = internQuery.in("id", allowedInternIds);
  }

  const { data: interns, error: internErr } = await internQuery.order("full_name", { ascending: true });

  if (internErr || !interns) {
    return { data: [], error: internErr };
  }

  // Ambil semua assessments
  const { data: assessments } = await db
    .from("assessments")
    .select("id, intern_id, final_score, status, feedback, score");

  const assessmentMap = new Map();
  if (assessments) {
    assessments.forEach(a => assessmentMap.set(a.intern_id, a));
  }

  // Gabungkan data
  const mapped = interns.map(i => {
    const ass = assessmentMap.get(i.id);
    return {
      ...i,
      assessment: ass ? {
        id: ass.id,
        final_score: ass.final_score,
        status: ass.status,
        feedback: ass.feedback,
        score: ass.score
      } : null
    };
  });

  return { data: mapped, error: null };
}

export async function getInternAssessment(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data, error } = await db
    .from("assessments")
    .select("id, intern_id, final_score, feedback, status, score, created_at, updated_at")
    .eq("intern_id", internProfileId)
    .maybeSingle();

  return { data, error };
}

/**
 * Sertifikat akhir magang (jalur penilaian) milik satu peserta.
 *
 * `.not("assessment_id", "is", null)` WAJIB ada. Tabel `certificates` memuat dua
 * jenis baris: sertifikat penilaian (punya `assessment_id`) dan sertifikat
 * penyelesaian course (punya `course_id`). Tanpa filter itu, `maybeSingle()`
 * melempar `PGRST116` begitu seorang peserta punya keduanya — dan halaman
 * sertifikat akhirnya menampilkan error, bukan sertifikatnya.
 *
 * Kenapa lubang ini belum pernah meledak: insert sertifikat course di
 * `features/lms/certificate-helper.ts` tidak pernah berhasil sekali pun (lihat
 * catatan di berkas itu), jadi baris jenis kedua tidak pernah ada. Memperbaiki
 * helper itu tanpa memasang filter ini akan memindahkan kegagalannya ke sini.
 *
 * Disaring lewat `assessment_id`, bukan `certificate_type`: kolom pertama ada
 * sejak `0001`, sementara `certificate_type` baru ada sejak `0021`. Filter
 * PostgREST atas kolom yang belum ada di produksi menggagalkan SELURUH kueri,
 * jadi bergantung pada `0021` di sini berarti halaman sertifikat mati total
 * kalau migrasi itu ternyata belum terpasang.
 */
export async function getInternCertificate(internProfileId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const { data, error } = await db
    .from("certificates")
    .select("id, intern_id, certificate_number, file_path, status, issued_at, signed_at, assessments(id, final_score, feedback, score)")
    .eq("intern_id", internProfileId)
    .not("assessment_id", "is", null)
    .maybeSingle();

  if (error || !data) {
    return { data: null, error };
  }

  const ass = Array.isArray(data.assessments) ? data.assessments[0] : data.assessments;
  return {
    data: {
      id: data.id,
      intern_id: data.intern_id,
      certificate_number: data.certificate_number,
      file_path: data.file_path,
      status: data.status,
      issued_at: data.issued_at,
      signed_at: data.signed_at,
      assessment: ass
    },
    error: null
  };
}


export async function getAttendanceSettings() {
  const db = await createUteroAcademyServiceRoleClient();
  const { data } = await db
    .from("attendance_settings")
    .select("certificate_template_path, check_in_time, check_out_time, late_tolerance_minutes, monthly_target_hours")
    .eq("id", ATTENDANCE_SETTINGS_ID)
    .maybeSingle();

  if (!data) return data;

  // Template sertifikat ada di bucket privat `avatars` dengan prefix literal
  // `settings/`, BUKAN `{userId}/`. Karena itu bucket privat tidak bisa memakai
  // predikat owner-scoped `(storage.foldername(name))[1] = auth.uid()::text`;
  // pembacaannya hanya lewat signed URL dari server (lihat 0032a).
  //
  // Halaman cetak (`app/dashboard/intern/certificate/print/page.tsx`)
  // menandatangani kolom yang sama secara terpisah dengan TTL `print` yang lebih
  // panjang — di sini TTL default sudah cukup karena hanya jadi tautan pratinjau.
  return {
    ...data,
    certificate_template_path: await resolveStorageUrl("avatars", data.certificate_template_path),
  };
}
