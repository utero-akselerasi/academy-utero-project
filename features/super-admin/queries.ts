import { createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { type Role, type School, type SchoolInternOption, type UserProfile, type UserRole } from "./types";

export async function getSuperAdminUserManagementData() {
  const db = await createUteroAcademyServiceRoleClient();
  const authClient = createSupabaseServiceRoleClient();

  const [profilesResult, rolesResult, userRolesResult, authUsersResult, schoolsResult, schoolContactsResult] = await Promise.all([
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
    db.from("school_contacts").select("id, user_id, school_id, schools(name)").returns<any[]>()
  ]);

  const profiles = profilesResult.data ?? [];
  const authUsers = authUsersResult.data?.users ?? [];
  const schoolContacts = schoolContactsResult.data ?? [];

  // Merge auth user details into profiles
  const mergedProfiles = profiles.map(profile => {
    const authUser = authUsers.find(u => u.id === profile.id);
    const contact = schoolContacts.find(sc => sc.user_id === profile.id);
    const schoolObj = contact ? (Array.isArray(contact.schools) ? contact.schools[0] : contact.schools) : null;
    return {
      ...profile,
      email: authUser?.email || "",
      last_sign_in_at: authUser?.last_sign_in_at || null,
      school_name: schoolObj?.name || null
    };
  });

  return {
    profiles: mergedProfiles,
    roles: rolesResult.data ?? [],
    userRoles: userRolesResult.data ?? [],
    schools: schoolsResult.data ?? [],
    error: profilesResult.error ?? rolesResult.error ?? userRolesResult.error ?? (authUsersResult.error as any) ?? schoolsResult.error,
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
      .select("id, full_name, email, major, status, school_id")
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
