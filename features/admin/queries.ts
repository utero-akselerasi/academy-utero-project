import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";

export async function getActiveInterns() {
  const db = await createUteroAcademyServiceRoleClient();
  
  // Fetch user_roles who have role code = intern
  const { data: userRoles } = await db
    .from("user_roles")
    .select("user_id, roles(code)")
    .returns<any[]>();

  const internUsers = (userRoles || []).filter(ur => {
    const r = ur.roles;
    const code = Array.isArray(r) ? r[0]?.code : r?.code;
    return code === "intern";
  });

  // Fetch all user_profiles for metadata
  const { data: userProfiles } = await db
    .from("user_profiles")
    .select("id, full_name, phone");

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach(p => profilesMap.set(p.id, p));
  }

  const interns = [];

  for (const iu of internUsers) {
    let { data: profile } = await db
      .from("intern_profiles")
      .select("id, full_name, email, major, status")
      .eq("user_id", iu.user_id)
      .maybeSingle();

    if (!profile) {
      const p = profilesMap.get(iu.user_id);
      const fullName = p?.full_name;
      const phone = p?.phone;

      // Auto-create intern profile
      const { data: newProfile } = await db
        .from("intern_profiles")
        .insert({
          user_id: iu.user_id,
          full_name: fullName || "Peserta Magang",
          phone: phone || null,
          status: "active"
        })
        .select("id, full_name, email, major, status")
        .maybeSingle();
      profile = newProfile;
    }

    if (profile && profile.status === "active") {
      interns.push(profile);
    }
  }

  // sort by full_name
  return interns.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function getMentors() {
  const db = await createUteroAcademyServiceRoleClient();
  
  // Fetch user_roles who have role code = mentor
  const { data: userRoles } = await db
    .from("user_roles")
    .select("user_id, roles(code)")
    .returns<any[]>();

  const mentorUsers = (userRoles || []).filter(ur => {
    const r = ur.roles;
    const code = Array.isArray(r) ? r[0]?.code : r?.code;
    return code === "mentor";
  });

  // Fetch all user_profiles for metadata
  const { data: userProfiles } = await db
    .from("user_profiles")
    .select("id, full_name");

  const profilesMap = new Map();
  if (userProfiles) {
    userProfiles.forEach(p => profilesMap.set(p.id, p));
  }

  const mentors = [];

  for (const mu of mentorUsers) {
    // Check if mentor profile exists
    let { data: profile } = await db
      .from("mentor_profiles")
      .select("id")
      .eq("user_id", mu.user_id)
      .maybeSingle();

    if (!profile) {
      // Auto-create mentor profile
      const { data: newProfile } = await db
        .from("mentor_profiles")
        .insert({ user_id: mu.user_id })
        .select("id")
        .maybeSingle();
      profile = newProfile;
    }

    if (profile) {
      const p = profilesMap.get(mu.user_id);
      const fullName = p?.full_name;
      mentors.push({
        id: profile.id,
        full_name: fullName || "Mentor " + profile.id.slice(0, 4)
      });
    }
  }

  return mentors;
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
    .select("id, mentor_id, intern_id, started_at, ended_at, mentor_profiles(id, user_id), intern_profiles(id, full_name, major)")
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
        major: internProfilesArray?.major || null
      }
    };
  });
}
