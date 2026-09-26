import { createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isActiveRoleCode } from "@/features/auth/roles";
import { type Role, type School, type SchoolInternOption, type UserProfile, type UserRole } from "./types";

export async function getSuperAdminUserManagementData() {
  const db = await createUteroAcademyServiceRoleClient();
  const authClient = createSupabaseServiceRoleClient();

  const [profilesResult, rolesResult, userRolesResult, authUsersResult, schoolsResult, schoolContactsResult, internProfilesResult] = await Promise.all([
    db
      .from("user_profiles")
      .select("id, full_name, phone, is_active, created_at")
      .order("created_at", { ascending: false })
      .returns<UserProfile[]>(),
    db.from("roles").select("id, code, name, description").order("name").returns<Role[]>(),
    db
      .from("user_roles")
      .select("id, user_id, role_id, roles(code, name)")
      .returns<UserRole[]>(),
    authClient.auth.admin.listUsers({
      perPage: 1000,
    }),
    db.from("schools").select("id, name").order("name").returns<any[]>(),
    db.from("school_contacts").select("id, user_id, school_id, email, schools(name)").returns<any[]>(),
    db.from("intern_profiles").select("user_id, email").returns<Array<{ user_id: string | null; email: string | null }>>()
  ]);

  const profiles = profilesResult.data ?? [];
  const authUsers = authUsersResult.data?.users ?? [];
  const schoolContacts = schoolContactsResult.data ?? [];
  const internProfiles = internProfilesResult.data ?? [];

  // Merge auth user details into profiles
  const mergedProfiles = profiles.map(profile => {
    const authUser = authUsers.find(u => u.id === profile.id);
    const contact = schoolContacts.find(sc => sc.user_id === profile.id);
    const internProfile = internProfiles.find(intern => intern.user_id === profile.id);
    const schoolObj = contact ? (Array.isArray(contact.schools) ? contact.schools[0] : contact.schools) : null;
    return {
      ...profile,
      email: authUser?.email || internProfile?.email || contact?.email || "",
      last_sign_in_at: authUser?.last_sign_in_at || null,
      auth_linked: Boolean(authUser),
      school_name: schoolObj?.name || null
    };
  });

  // Dropdown penetapan peran hanya boleh menawarkan peran login yang berlaku.
  // Baris `mentor` dan `admin_academy` sengaja DIBIARKAN hidup di tabel `roles`
  // oleh migrasi 0028 (`user_roles.role_id` adalah ON DELETE CASCADE, jadi
  // menghapusnya ikut menghapus riwayat penempatan), jadi kueri ini masih
  // mengembalikannya.
  //
  // Disaring di sini, bukan lewat `.eq("is_assignable", true)`: kolom itu baru
  // ada SETELAH 0028 dijalankan, dan filter PostgREST atas kolom yang belum ada
  // menggagalkan seluruh kueri — halaman super-admin akan mati total. Setelah
  // 0028 diterapkan, filter database boleh ditambahkan sebagai lapis kedua.
  const assignableRoles = (rolesResult.data ?? []).filter((role) => isActiveRoleCode(role.code));

  return {
    profiles: mergedProfiles,
    roles: assignableRoles,
    userRoles: userRolesResult.data ?? [],
    schools: schoolsResult.data ?? [],
    error: profilesResult.error ?? rolesResult.error ?? userRolesResult.error ?? (authUsersResult.error as any) ?? schoolsResult.error ?? schoolContactsResult.error ?? internProfilesResult.error,
  };
}

export async function getSuperAdminSchoolsData() {
  const db = await createUteroAcademyServiceRoleClient();

  const [schoolsResult, contactsResult, internsResult] = await Promise.all([
    db
      .from("schools")
      .select("id, name, type, city, province, address, logo_path, created_at")
      .order("name", { ascending: true })
      .returns<School[]>(),
    db
      .from("school_contacts")
      .select("id, school_id, user_id, name, email, phone, position, schools(name)")
      .returns<any[]>(),
    db
      .from("intern_profiles")
      .select("id, full_name, email, major, status, school_id, start_date, end_date, grade_or_semester")
      .order("full_name", { ascending: true })
      .returns<SchoolInternOption[]>(),
  ]);

  const contacts = contactsResult.data ?? [];
  const interns = internsResult.data ?? [];

  const schools = (schoolsResult.data ?? []).map((school) => ({
    ...school,
    contacts_count: contacts.filter((contact) => contact.school_id === school.id).length,
    interns_count: interns.filter((intern) => intern.school_id === school.id).length,
  }));

  return {
    schools,
    contacts,
    interns,
    unassignedInterns: interns.filter((intern) => !intern.school_id),
    error: schoolsResult.error ?? contactsResult.error ?? internsResult.error,
  };
}


export async function detectOrphanData() {
  const db = await createUteroAcademyServiceRoleClient();
  const authClient = createSupabaseServiceRoleClient();

  const [allSchoolContacts, allAuthUsers, allInterns, allSchools] = await Promise.all([
    db.from("school_contacts").select("id, user_id, school_id, name").returns<Array<{ id: string; user_id: string | null; school_id: string; name: string }>>(),
    authClient.auth.admin.listUsers({ perPage: 1000 }),
    db.from("intern_profiles").select("id, school_id, full_name").returns<Array<{ id: string; school_id: string | null; full_name: string }>>(),
    db.from("schools").select("id, name").returns<Array<{ id: string; name: string }>>(),
  ]);

  const authUserIds = new Set(allAuthUsers.data?.users.map(u => u.id) || []);
  const schoolIds = new Set(allSchools.data?.map(s => s.id) || []);

  const orphanContacts = allSchoolContacts.data?.filter((contact) => {
    if (!contact.user_id) return true;
    return !authUserIds.has(contact.user_id);
  }) || [];

  const orphanInterns = allInterns.data?.filter((intern) => {
    if (!intern.school_id) return false;
    return !schoolIds.has(intern.school_id);
  }) || [];

  const schoolContactsWithoutSchool = allSchoolContacts.data?.filter((contact) => {
    return !schoolIds.has(contact.school_id);
  }) || [];

  return {
    orphanContacts,
    orphanInterns,
    schoolContactsWithoutSchool,
    total: orphanContacts.length + orphanInterns.length + schoolContactsWithoutSchool.length,
    error: allSchoolContacts.error || allSchools.error,
  };
}


export type MissingDomainProfile = {
  userId: string;
  fullName: string;
  roleCode: string;
  table: "intern_profiles" | "mentor_profiles";
};

/**
 * User yang punya role tapi belum punya profil domain pendampingnya.
 *
 * Dulu profil dibuat malas saat halaman dibuka, jadi kekurangan seperti ini
 * tidak pernah terlihat. Setelah penulisan di jalur GET dihapus, kekurangan itu
 * harus tampil eksplisit supaya super admin bisa melengkapinya lewat aksi
 * ber-audit, bukan lewat efek samping render.
 *
 * Hanya membaca.
 */
export async function detectMissingDomainProfiles() {
  const db = await createUteroAcademyServiceRoleClient();

  const [userRolesResult, profilesResult, internsResult, mentorsResult] = await Promise.all([
    db.from("user_roles").select("user_id, roles(code)").returns<any[]>(),
    db.from("user_profiles").select("id, full_name").returns<Array<{ id: string; full_name: string }>>(),
    db.from("intern_profiles").select("user_id").returns<Array<{ user_id: string | null }>>(),
    db.from("mentor_profiles").select("user_id").returns<Array<{ user_id: string | null }>>(),
  ]);

  const nameById = new Map((profilesResult.data ?? []).map((p) => [p.id, p.full_name]));
  const hasIntern = new Set((internsResult.data ?? []).map((r) => r.user_id).filter(Boolean) as string[]);
  const hasMentor = new Set((mentorsResult.data ?? []).map((r) => r.user_id).filter(Boolean) as string[]);

  const missing: MissingDomainProfile[] = [];
  // Satu user bisa memegang beberapa role staf (admin + admin_academy), tapi
  // profil pembimbingnya hanya satu baris. Tanpa dedup, satu kekurangan yang
  // sama akan terhitung dua kali di laporan maupun di hasil backfill.
  //
  // Kode legacy `admin_academy`/`mentor` SENGAJA masih dihitung di bawah: baris
  // `user_roles` lama dibiarkan hidup oleh migrasi 0028, dan user lama itu tetap
  // butuh baris `mentor_profiles`-nya. Baris itu bukan bukti otorisasi
  // (keputusan C-2) — otorisasi tetap lewat `getUserRoleCodes`, yang menyaring
  // kode legacy — jadi menghitungnya di sini tidak memberi hak apa pun.
  const seen = new Set<string>();

  for (const row of userRolesResult.data ?? []) {
    const r = row.roles;
    const code = (Array.isArray(r) ? r[0]?.code : r?.code) as string | undefined;
    const userId = row.user_id as string;
    if (!code || !userId) continue;

    if (code === "intern" && !hasIntern.has(userId)) {
      if (seen.has(userId + ":intern_profiles")) continue;
      seen.add(userId + ":intern_profiles");
      missing.push({
        userId,
        fullName: nameById.get(userId) || "(tanpa profil dasar)",
        roleCode: code,
        table: "intern_profiles",
      });
    } else if ((code === "admin" || code === "admin_academy" || code === "mentor") && !hasMentor.has(userId)) {
      if (seen.has(userId + ":mentor_profiles")) continue;
      seen.add(userId + ":mentor_profiles");
      missing.push({
        userId,
        fullName: nameById.get(userId) || "(tanpa profil dasar)",
        roleCode: code,
        table: "mentor_profiles",
      });
    }
  }

  return {
    missing,
    total: missing.length,
    error: userRolesResult.error || profilesResult.error || internsResult.error || mentorsResult.error,
  };
}
