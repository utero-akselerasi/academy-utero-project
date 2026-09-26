import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

/**
 * Daftar peserta aktif, HANYA BACA.
 *
 * Versi sebelumnya menyisipkan baris `intern_profiles` untuk setiap user
 * berperan intern yang belum punya profil. Itu berarti sekadar membuka halaman
 * (GET, bisa dipicu prefetch) menulis data - tanpa proteksi CSRF, tanpa jejak
 * audit, dan baris yang dibuat selalu tanpa email dengan nama fallback
 * "Peserta Magang". Pembuatan profil sekarang urusan onboarding eksplisit;
 * fungsi ini tidak lagi menulis apa pun.
 *
 * Sekaligus menghapus N+1 query: satu query intern_profiles, bukan satu per
 * user.
 */
export async function getActiveInterns() {
  const db = await createUteroAcademyServiceRoleClient();

  // Fetch user_roles who have role code = intern
  const { data: userRoles } = await db
    .from("user_roles")
    .select("user_id, roles(code)")
    .returns<any[]>();

  const internUserIds = (userRoles || [])
    .filter(ur => {
      const r = ur.roles;
      const code = Array.isArray(r) ? r[0]?.code : r?.code;
      return code === "intern";
    })
    .map(ur => ur.user_id as string);

  if (internUserIds.length === 0) {
    return [];
  }

  const { data: profiles, error } = await db
    .from("intern_profiles")
    .select("id, full_name, email, major, status")
    .eq("status", "active")
    .in("user_id", internUserIds);

  if (error) {
    console.error("Gagal membaca daftar peserta aktif:", error);
    return [];
  }

  return (profiles ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * Daftar pembimbing yang bisa dipilih, HANYA BACA.
 *
 * Sama seperti getActiveInterns(): versi lama menyisipkan baris
 * `mentor_profiles` saat halaman dibuka. Pembuatan profil pembimbing adalah
 * urusan super admin (features/super-admin/actions.ts), bukan efek samping
 * sebuah GET. Admin tanpa mentor_profiles tidak muncul di sini dan memang
 * belum bisa menerima penempatan - itu keadaan yang benar, bukan alasan untuk
 * menulis diam-diam.
 */
export async function getMentors() {
  const db = await createUteroAcademyServiceRoleClient();

  // Fetch user_roles who have role code = admin
  const { data: userRoles } = await db
    .from("user_roles")
    .select("user_id, roles(code)")
    .returns<any[]>();

  const adminUserIds = (userRoles || [])
    .filter(ur => {
      const r = ur.roles;
      const code = Array.isArray(r) ? r[0]?.code : r?.code;
      return code === "admin";
    })
    .map(ur => ur.user_id as string);

  if (adminUserIds.length === 0) {
    return [];
  }

  // Fetch all user_profiles for metadata
  const { data: userProfiles } = await db
    .from("user_profiles")
    .select("id, full_name");

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach(p => profilesMap.set(p.id, p));
  }

  const { data: profiles, error } = await db
    .from("mentor_profiles")
    .select("id, user_id")
    .in("user_id", adminUserIds);

  if (error) {
    console.error("Gagal membaca daftar pembimbing:", error);
    return [];
  }

  const mentors = (profiles ?? []).map((profile) => {
    const p = profilesMap.get(profile.user_id);
    return {
      id: profile.id as string,
      full_name: (p?.full_name as string | undefined) || "Admin " + (profile.id as string).slice(0, 4),
    };
  });

  // sort by name
  return mentors.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export type MentorAssignmentDetail = {
  id: string;
  mentor_id: string;
  intern_id: string;
  started_at: string;
  ended_at: string | null;
  mentor_profiles: {
    id: string;
    user_profiles: {
      full_name: string;
    } | null;
  } | null;
  intern_profiles: {
    id: string;
    full_name: string;
    major: string | null;
  } | null;
};

export async function getMentorAssignments() {
  const db = await createUteroAcademyServiceRoleClient();
  
  // We query mentor assignments
  const { data } = await db
    .from("mentor_assignments")
    .select("id, mentor_id, intern_id, started_at, ended_at, mentor_profiles(id, user_id), intern_profiles(id, full_name, major, email, phone, schools(name))")
    .order("created_at", { ascending: false })
    .returns<any[]>();
    
  if (!data || data.length === 0) {
    return [];
  }

  // Fetch all user_profiles for metadata
  const { data: userProfiles } = await db
    .from("user_profiles")
    .select("id, full_name");

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach(p => profilesMap.set(p.id, p));
  }

  return data.map(item => {
    const mp = item.mentor_profiles;
    const ip = item.intern_profiles;
    
    const mentorProfilesArray = Array.isArray(mp) ? mp[0] : mp;
    const internProfilesArray = Array.isArray(ip) ? ip[0] : ip;

    const mentorUserId = mentorProfilesArray?.user_id;
    const mentorUser = mentorUserId ? profilesMap.get(mentorUserId) : null;
    const mentorName = mentorUser?.full_name;

    return {
      id: item.id,
      mentor_id: item.mentor_id,
      intern_id: item.intern_id,
      started_at: item.started_at,
      ended_at: item.ended_at,
      mentor_profiles: {
        id: mentorProfilesArray?.id,
        user_profiles: {
          full_name: mentorName || "Mentor"
        }
      },
      intern_profiles: {
        id: internProfilesArray?.id,
        full_name: internProfilesArray?.full_name || "Peserta",
        major: internProfilesArray?.major || null,
        email: internProfilesArray?.email || null,
        phone: internProfilesArray?.phone || null,
        school_name: Array.isArray(internProfilesArray?.schools) ? internProfilesArray.schools[0]?.name : internProfilesArray?.schools?.name || null
      }
    };
  });
}
