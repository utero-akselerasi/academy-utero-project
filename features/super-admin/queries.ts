import { createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { type Role, type UserProfile, type UserRole } from "./types";

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
