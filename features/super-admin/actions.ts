"use server";

import { requireAdmin, requireSuperAdmin } from "@/features/auth/guards";
import { userIsSuperAdmin } from "@/features/auth/roles";
import { createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { listAllAuthUsers } from "@/lib/auth-admin";
import { detectMissingDomainProfiles } from "./queries";
import { writeAuditLog } from "./audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateInternPeriodSchema } from "./schemas";
import { backendRequest, usesLocalBackend } from "@/lib/backend/server";

const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

const schoolSchema = z.object({
  schoolId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(2, "Nama instansi minimal 2 karakter."),
  type: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  logoPath: z.string().nullable().optional(),
});

// Guard terpusat dipakai supaya Server Action ini tetap terlindungi meski
// dipanggil langsung lewat action ID, bukan hanya lewat layout/page.
const requireUserManagementAccess = requireAdmin;

/**
 * Siapkan profil domain sesuai role, sekali di titik pemberian role.
 *
 * Dulu profil dibuat malas (lazy) saat halaman dibuka - getInternProfileId()
 * dan features/admin/queries.ts menyisipkan baris di jalur GET. Pembuatan data
 * harus terjadi di aksi eksplisit yang ber-audit, bukan sebagai efek samping
 * render. Fungsi ini dipanggil dari assignUserRoleAction dan
 * createUserManualAction.
 *
 * Idempoten: user_id unik di kedua tabel, jadi 23505 (unique violation)
 * berarti profil sudah ada dan itu bukan kegagalan.
 */
async function provisionDomainProfile(
  db: Awaited<ReturnType<typeof createUteroAcademyServiceRoleClient>>,
  userId: string,
  roleCode: string,
  fallback?: { fullName?: string | null; email?: string | null; phone?: string | null },
) {
  if (roleCode === "intern") {
    let fullName = fallback?.fullName ?? null;
    let phone = fallback?.phone ?? null;

    if (!fullName) {
      const { data: userProfile } = await db
        .from("user_profiles")
        .select("full_name, phone")
        .eq("id", userId)
        .maybeSingle();
      fullName = (userProfile?.full_name as string | undefined) ?? null;
      phone = phone ?? ((userProfile?.phone as string | undefined) ?? null);
    }

    // full_name NOT NULL di skema; tanpa user_profiles tidak ada nama yang
    // sah untuk dipakai, jadi lebih baik gagal terang daripada membuat baris
    // dengan nama palsu.
    if (!fullName) {
      throw new Error("Profil dasar user belum ada, tidak bisa membuat profil peserta.");
    }

    const { error } = await db.from("intern_profiles").insert({
      user_id: userId,
      full_name: fullName,
      email: fallback?.email ?? null,
      phone,
      status: "active",
    });

    if (error && error.code !== "23505") {
      throw new Error("Gagal membuat profil peserta: " + error.message);
    }
    return;
  }

  // Kode legacy `admin_academy` dan `mentor` SENGAJA masih diterima di sini.
  // Keduanya bukan lagi peran login — dropdown penetapan peran tidak
  // menawarkannya (disaring di queries.ts) — tapi baris `user_roles` lama
  // dibiarkan hidup oleh migrasi 0028, dan backfillDomainProfilesAction masih
  // bisa menyampaikan kode itu ke fungsi ini untuk user lama.
  //
  // Aman karena baris `mentor_profiles` BUKAN bukti otorisasi (keputusan C-2):
  // otorisasi hanya dari `user_roles` lewat current_user_has_role(). Fungsi ini
  // murni menyediakan baris data domain.
  if (roleCode === "admin" || roleCode === "admin_academy" || roleCode === "mentor") {
    const { error } = await db.from("mentor_profiles").insert({ user_id: userId });

    if (error && error.code !== "23505") {
      throw new Error("Gagal membuat profil pembimbing: " + error.message);
    }
  }
}

export async function assignUserRoleAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const parsed = assignRoleSchema.safeParse({
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
  });

  if (!parsed.success) {
    throw new Error("Data role tidak valid.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/super-admin/roles", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data),
    });
    if (!response.ok) throw new Error("Gagal menetapkan role pada backend lokal.");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("user_roles").insert({
    user_id: parsed.data.userId,
    role_id: parsed.data.roleId,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  await writeAuditLog(
    user.id,
    "assign_role",
    "user_roles",
    parsed.data.userId,
    null,
    { roleId: parsed.data.roleId }
  );

  // Profil domain disiapkan di sini, bukan malas saat halaman dibuka. Tanpa ini
  // pemberian role intern lewat halaman User & Role tidak menghasilkan
  // intern_profiles sama sekali setelah insert di jalur GET dihapus.
  const { data: role } = await db
    .from("roles")
    .select("code")
    .eq("id", parsed.data.roleId)
    .maybeSingle();

  if (role?.code) {
    await provisionDomainProfile(db, parsed.data.userId, role.code as string);

    await writeAuditLog(
      user.id,
      "provision_domain_profile",
      "user_roles",
      parsed.data.userId,
      null,
      { roleCode: role.code }
    );
  }

  revalidatePath("/dashboard/super-admin/users");
}

export async function removeUserRoleAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const id = z.string().uuid().parse(formData.get("id"));
  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/roles/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Gagal menghapus role pada backend lokal.");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }
  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("user_roles").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await writeAuditLog(
    user.id,
    "remove_role",
    "user_roles",
    id
  );

  revalidatePath("/dashboard/super-admin/users");
}


export async function createUserManualAction(formData: FormData) {
  const user = await requireUserManagementAccess();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const phone = formData.get("phone") as string;
  const roleId = formData.get("roleId") as string;

  if (!email || !password || !fullName) {
    throw new Error("Email, password, dan nama lengkap wajib diisi.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/super-admin/users", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, fullName, phone, roleId }),
    });
    if (!response.ok) throw new Error("Gagal membuat user pada backend lokal.");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { data: role } = await db.from("roles").select("code").eq("id", roleId).maybeSingle();
  const isSuperAdmin = await userIsSuperAdmin(user.id);

  if (!role || (!isSuperAdmin && !["intern", "school"].includes(role.code))) {
    throw new Error("Admin hanya dapat menambahkan user dengan role Intern atau Sekolah.");
  }

  const supabase = createSupabaseServiceRoleClient();
  
  // Create user in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      source_app: "utero_academy",
    }
  });

  if (authError) {
    console.error("Gagal create user auth:", authError);
    throw new Error("Gagal membuat user di Auth: " + authError.message);
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("User ID tidak ditemukan setelah pembuatan.");
  }

  // Insert profile
  const { error: profileError } = await db.from("user_profiles").insert({
    id: userId,
    full_name: fullName,
    phone: phone || null,
    is_active: true
  });

  if (profileError) {
    console.error("Gagal insert profile:", profileError);
    throw new Error("Gagal membuat profil user: " + profileError.message);
  }

  // Assign role if chosen
  if (roleId) {
    const { error: roleError } = await db.from("user_roles").insert({
      user_id: userId,
      role_id: roleId
    });

    if (roleError) {
      console.error("Gagal assign role:", roleError);
    }

    await writeAuditLog(
      user.id,
      "create_user",
      "user_profiles",
      userId,
      null,
      { email, fullName, roleId }
    );

    // Fetch role code to auto-provision profile
    const { data: roleData } = await db
      .from("roles")
      .select("code")
      .eq("id", roleId)
      .maybeSingle();

    if (roleData?.code) {
      await provisionDomainProfile(db, userId, roleData.code as string, {
        fullName,
        email,
        phone: phone || null,
      });
    }
  }

  revalidatePath("/dashboard/super-admin/users");
}

export async function updateUserAdminAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const userId = formData.get("userId") as string;
  const fullName = formData.get("fullName") as string;
  const phone = formData.get("phone") as string;
  const isActive = formData.get("isActive") === "true";

  if (!userId || !fullName) {
    throw new Error("ID pengguna dan nama lengkap wajib diisi.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName, phone, isActive }),
    });
    if (!response.ok) throw new Error("Gagal mengupdate profil pada backend lokal.");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();

  // Update profile
  const { error: profileError } = await db
    .from("user_profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
      is_active: isActive,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (profileError) {
    console.error("Gagal update user profile:", profileError);
    throw new Error("Gagal mengupdate profil: " + profileError.message);
  }

  // Sync to intern_profiles if exists
  await db
    .from("intern_profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  await writeAuditLog(
    user.id,
    "update_user",
    "user_profiles",
    userId,
    null,
    { fullName, phone, isActive }
  );

  revalidatePath("/dashboard/super-admin/users");
}

export async function resetUserPasswordAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const userId = formData.get("userId") as string;
  const password = formData.get("password") as string;

  if (!userId || !password || password.length < 12) {
    throw new Error("Password minimal 12 karakter.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/users/${encodeURIComponent(userId)}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new Error("Gagal meriset kata sandi.");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: password
  });

  if (error) {
    console.error("Gagal reset password user:", error);
    throw new Error("Gagal meriset kata sandi: " + error.message);
  }

  await writeAuditLog(
    user.id,
    "reset_password",
    "auth.users",
    userId,
    null,
    { executorId: user.id }
  );

  revalidatePath("/dashboard/super-admin/users");
}

export async function activateImportedUserAction(formData: FormData) {
  await requireSuperAdmin();

  const userId = formData.get("userId") as string;
  if (!userId) throw new Error("ID pengguna wajib diisi.");
  if (!usesLocalBackend()) throw new Error("Aktivasi akun impor hanya tersedia pada backend lokal.");

  const response = await backendRequest(`/v1/super-admin/users/${encodeURIComponent(userId)}/activate`, {
    method: "POST",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    const messages: Record<string, string> = {
      role_required: "Tetapkan role pengguna sebelum mengirim undangan.",
      pending_user_not_found: "Akun tidak lagi menunggu aktivasi.",
      invitation_email_unavailable: "SMTP gagal mengirim email undangan.",
    };
    throw new Error(messages[body?.error ?? ""] ?? "Gagal mengirim undangan aktivasi.");
  }

  revalidatePath("/dashboard/super-admin/users");
}

export async function deleteUserAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const userId = formData.get("userId") as string;

  if (!userId) {
    throw new Error("ID pengguna wajib diisi.");
  }

  if (userId === user.id) {
    throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Gagal menghapus user pada backend lokal.");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error("Gagal delete user:", error);
    throw new Error("Gagal menghapus user: " + error.message);
  }

  await writeAuditLog(
    user.id,
    "delete_user",
    "auth.users",
    userId
  );

  revalidatePath("/dashboard/super-admin/users");
}

export async function linkSchoolContactAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const userId = formData.get("userId") as string;
  const schoolId = formData.get("schoolId") as string;
  const position = formData.get("position") as string;

  if (!userId) {
    throw new Error("ID pengguna wajib diisi.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/users/${encodeURIComponent(userId)}/school-contact`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ schoolId: schoolId || null, position }),
    });
    if (!response.ok) throw new Error("Gagal menghubungkan perwakilan pada backend lokal.");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();

  // Ambil profil user untuk metadata kontak sekolah
  const { data: profile } = await db
    .from("user_profiles")
    .select("full_name, phone")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    throw new Error("Profil pengguna tidak ditemukan.");
  }

  // Ambil email dari auth users
  const supabase = createSupabaseServiceRoleClient();
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser.user?.email || null;

  // Hapus kontak instansi sebelumnya untuk user ini jika ada
  await db.from("school_contacts").delete().eq("user_id", userId);

  if (schoolId) {
    const { error: insertError } = await db.from("school_contacts").insert({
      user_id: userId,
      school_id: schoolId,
      name: profile.full_name,
      email: email,
      phone: profile.phone || null,
      position: position || "Perwakilan Instansi"
    });

    if (insertError) {
      console.error("Gagal link kontak sekolah:", insertError);
      throw new Error("Gagal menghubungkan perwakilan ke sekolah: " + insertError.message);
    }
  }

  await writeAuditLog(
    user.id,
    "link_school_contact",
    "school_contacts",
    userId,
    null,
    { schoolId, position }
  );

  revalidatePath("/dashboard/super-admin/users");
}

export async function inviteSchoolContactAction(formData: FormData) {
  await requireSuperAdmin();
  const schoolId = formData.get("schoolId");
  const contactId = formData.get("contactId");
  if (typeof schoolId !== "string" || typeof contactId !== "string") throw new Error("Kontak sekolah tidak valid.");
  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/schools/${encodeURIComponent(schoolId)}/invite`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactId }),
    });
    if (!response.ok) throw new Error("Undangan sekolah belum berhasil dikirim.");
    revalidatePath("/dashboard/super-admin/schools");
    return;
  }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: contact, error } = await db.from("school_contacts").select("name,email").eq("id", contactId).eq("school_id", schoolId).maybeSingle();
  if (error || !contact?.email) throw new Error("Kontak sekolah tidak ditemukan.");
  const supabase = createSupabaseServiceRoleClient();
  const invited = await supabase.auth.admin.inviteUserByEmail(contact.email, { data: { full_name: contact.name, source_app: "utero_academy_school" } });
  if (invited.error || !invited.data.user) throw new Error("Undangan sekolah belum berhasil dikirim.");
  const { data: role } = await db.from("roles").select("id").eq("code", "school").maybeSingle();
  if (!role) throw new Error("Role sekolah belum tersedia.");
  await db.from("user_profiles").insert({ id: invited.data.user.id, full_name: contact.name, is_active: true });
  await db.from("user_roles").insert({ user_id: invited.data.user.id, role_id: role.id });
  await db.from("school_contacts").update({ user_id: invited.data.user.id }).eq("id", contactId).eq("school_id", schoolId);
  revalidatePath("/dashboard/super-admin/schools");
}

export async function createSchoolAction(formData: FormData) {
  const user = await requireSuperAdmin();
  const parsed = schoolSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || null,
    city: formData.get("city") || null,
    province: formData.get("province") || null,
    address: formData.get("address") || null,
    logoPath: formData.get("logoPath") || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Data instansi tidak valid.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/super-admin/schools", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data),
    });
    if (!response.ok) throw new Error("Gagal menambahkan instansi pada backend lokal.");
    revalidatePath("/dashboard/super-admin/schools");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("schools")
    .insert({
      name: parsed.data.name,
      type: parsed.data.type || null,
      city: parsed.data.city || null,
      province: parsed.data.province || null,
      address: parsed.data.address || null,
      logo_path: parsed.data.logoPath || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error("Gagal menambahkan instansi: " + error.message);
  }

  await writeAuditLog(user.id, "create_school", "schools", data.id, null, parsed.data);
  revalidatePath("/dashboard/super-admin/schools");
  revalidatePath("/dashboard/super-admin/users");
}

export async function updateSchoolAction(formData: FormData) {
  const user = await requireSuperAdmin();
  const parsed = schoolSchema.safeParse({
    schoolId: formData.get("schoolId"),
    name: formData.get("name"),
    type: formData.get("type") || null,
    city: formData.get("city") || null,
    province: formData.get("province") || null,
    address: formData.get("address") || null,
    logoPath: formData.get("logoPath") || null,
  });

  if (!parsed.success || !parsed.data.schoolId) {
    throw new Error(parsed.error?.issues[0]?.message || "ID instansi tidak valid.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/schools/${encodeURIComponent(parsed.data.schoolId)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data),
    });
    if (!response.ok) throw new Error("Gagal memperbarui instansi pada backend lokal.");
    revalidatePath("/dashboard/super-admin/schools");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db
    .from("schools")
    .update({
      name: parsed.data.name,
      type: parsed.data.type || null,
      city: parsed.data.city || null,
      province: parsed.data.province || null,
      address: parsed.data.address || null,
      logo_path: parsed.data.logoPath || null,
    })
    .eq("id", parsed.data.schoolId);

  if (error) {
    throw new Error("Gagal memperbarui instansi: " + error.message);
  }

  await writeAuditLog(user.id, "update_school", "schools", parsed.data.schoolId, null, parsed.data);
  revalidatePath("/dashboard/super-admin/schools");
  revalidatePath("/dashboard/super-admin/users");
}

export async function updateSchoolPartnershipAction(formData: FormData) {
  const user = await requireSuperAdmin();
  const parsed = z.object({
    schoolId: z.string().uuid(),
    partnerStatus: z.enum(["prospect", "verified", "active_partner", "suspended", "ended"]),
    referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{6,32}$/, "Kode unik 6–32 huruf, angka, atau tanda hubung.").or(z.literal("")),
    referralQuota: z.union([z.literal(""), z.coerce.number().int().min(1).max(100000)]),
    referralExpiresAt: z.union([z.literal(""), z.string().date()]),
  }).safeParse({
    schoolId: formData.get("schoolId"), partnerStatus: formData.get("partnerStatus"),
    referralCode: formData.get("referralCode"), referralQuota: formData.get("referralQuota"),
    referralExpiresAt: formData.get("referralExpiresAt"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Data kemitraan tidak valid.");
  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/schools/${encodeURIComponent(parsed.data.schoolId)}/partnership`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data),
    });
    if (!response.ok) throw new Error("Kemitraan belum berhasil disimpan pada backend lokal.");
    revalidatePath("/dashboard/super-admin/schools");
    return;
  }
  const db = await createUteroAcademyServiceRoleClient();
  const { data: previous, error: readError } = await db.from("schools")
    .select("partner_status, referral_code, referral_quota, referral_expires_at")
    .eq("id", parsed.data.schoolId).single();
  if (readError || !previous) throw new Error("Sekolah belum ditemukan.");
  const { error } = await db.from("schools").update({
    partner_status: parsed.data.partnerStatus,
    referral_code: parsed.data.referralCode || null,
    referral_quota: parsed.data.referralQuota === "" ? null : parsed.data.referralQuota,
    referral_expires_at: parsed.data.referralExpiresAt ? `${parsed.data.referralExpiresAt}T23:59:59+07:00` : null,
    verified_by: ["verified", "active_partner"].includes(parsed.data.partnerStatus) ? user.id : null,
    verified_at: ["verified", "active_partner"].includes(parsed.data.partnerStatus) ? new Date().toISOString() : null,
  }).eq("id", parsed.data.schoolId);
  if (error) throw new Error(`Kemitraan belum berhasil disimpan: ${error.message}`);
  await writeAuditLog(user.id, "update_school_partnership", "schools", parsed.data.schoolId, previous, parsed.data);
  revalidatePath("/dashboard/super-admin/schools");
}

export async function deleteSchoolAction(formData: FormData) {
  const user = await requireSuperAdmin();
  const schoolId = formData.get("schoolId") as string;

  if (!schoolId) {
    throw new Error("ID instansi wajib diisi.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/schools/${encodeURIComponent(schoolId)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Gagal menghapus instansi pada backend lokal.");
    revalidatePath("/dashboard/super-admin/schools");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();
  const [{ count: contactsCount }, { count: internsCount }] = await Promise.all([
    db.from("school_contacts").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    db.from("intern_profiles").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
  ]);

  if ((contactsCount || 0) > 0 || (internsCount || 0) > 0) {
    throw new Error("Instansi masih terhubung ke perwakilan atau siswa. Lepaskan relasinya terlebih dahulu.");
  }

  const { error } = await db.from("schools").delete().eq("id", schoolId);
  if (error) {
    throw new Error("Gagal menghapus instansi: " + error.message);
  }

  await writeAuditLog(user.id, "delete_school", "schools", schoolId);
  revalidatePath("/dashboard/super-admin/schools");
  revalidatePath("/dashboard/super-admin/users");
}


export async function linkInternToSchoolAction(formData: FormData) {
  const user = await requireSuperAdmin();
  const internId = formData.get("internId") as string;
  const schoolId = formData.get("schoolId") as string;

  if (!internId) {
    throw new Error("Siswa wajib dipilih.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/interns/${encodeURIComponent(internId)}/school`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ schoolId: schoolId || null }),
    });
    if (!response.ok) throw new Error("Gagal menghubungkan siswa pada backend lokal.");
    revalidatePath("/dashboard/super-admin/schools");
    revalidatePath("/dashboard/school");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db
    .from("intern_profiles")
    .update({
      school_id: schoolId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", internId);

  if (error) {
    throw new Error("Gagal menghubungkan siswa ke instansi: " + error.message);
  }

  await writeAuditLog(
    user.id,
    "link_intern_school",
    "intern_profiles",
    internId,
    null,
    { schoolId: schoolId || null }
  );

  revalidatePath("/dashboard/super-admin/schools");
  revalidatePath("/dashboard/school");
}

export async function cleanupOrphanDataAction(formData: FormData) {
  const user = await requireSuperAdmin();
  const orphanType = formData.get("orphanType") as string; // 'contacts', 'interns', 'all'
  
  if (!orphanType || !['contacts', 'interns', 'all'].includes(orphanType)) {
    throw new Error("Tipe orphan tidak valid.");
  }

  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/super-admin/orphans/cleanup", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orphanType }),
    });
    if (!response.ok) throw new Error("Pembersihan data yatim gagal pada backend lokal.");
    revalidatePath("/dashboard/super-admin/schools");
    revalidatePath("/dashboard/super-admin/users");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();
  const authClient = createSupabaseServiceRoleClient();

  // Fetch semua data untuk deteksi.
  //
  // `listAllAuthUsers` menyusuri semua halaman dan MELEMPAR kalau daftarnya
  // tidak bisa dijamin lengkap. Ini titik paling kritis dari ketiga pemakaian
  // helper itu: `authUserIds` di bawah menentukan baris `school_contacts` mana
  // yang DIHAPUS PERMANEN. Dengan `listUsers({ perPage: 1000 })` yang lama,
  // satu user yang cuma tidak terambil sudah cukup untuk membuat kontaknya
  // terhapus — dan penghapusannya tercatat di audit log sebagai pembersihan
  // yang berhasil, jadi tidak ada jejak bahwa itu salah.
  const [allSchoolContacts, allAuthUsers, allInterns, allSchools] = await Promise.all([
    db.from("school_contacts").select("id, user_id, school_id").returns<Array<{ id: string; user_id: string | null; school_id: string }>>(),
    listAllAuthUsers(authClient),
    db.from("intern_profiles").select("id, school_id").returns<Array<{ id: string; school_id: string | null }>>(),
    db.from("schools").select("id").returns<Array<{ id: string }>>(),
  ]);

  // Error kueri TIDAK boleh jatuh ke `|| []` di sini. `allSchools.error` yang
  // lolos menghasilkan `schoolIds` kosong, dan kombinasi itu menandai SETIAP
  // kontak sekolah sebagai yatim lalu menghapus semuanya. Kegagalan baca harus
  // menghentikan pembersihan, bukan memperluasnya.
  if (allSchoolContacts.error || allInterns.error || allSchools.error) {
    const detail = allSchoolContacts.error?.message
      ?? allInterns.error?.message
      ?? allSchools.error?.message;
    throw new Error(
      "Pembersihan dibatalkan: data pembanding gagal dibaca, jadi status yatim tidak bisa ditentukan. " + detail,
    );
  }

  const authUserIds = new Set(allAuthUsers.map(u => u.id));
  const schoolIds = new Set(allSchools.data?.map(s => s.id) || []);

  let deletedCount = 0;

  // Cleanup orphan contacts (user tidak ada atau sekolah tidak ada)
  if (orphanType === 'contacts' || orphanType === 'all') {
    const orphanContacts = (allSchoolContacts.data || []).filter((contact) => {
      if (!contact.user_id) return true;
      if (!schoolIds.has(contact.school_id)) return true;
      return !authUserIds.has(contact.user_id);
    });

    if (orphanContacts.length > 0) {
      const { error } = await db
        .from("school_contacts")
        .delete()
        .in("id", orphanContacts.map(c => c.id));

      if (error) {
        throw new Error("Gagal hapus orphan contacts: " + error.message);
      }
      deletedCount += orphanContacts.length;
    }
  }

  // Cleanup orphan interns (sekolah tidak ada)
  if (orphanType === 'interns' || orphanType === 'all') {
    const orphanInterns = (allInterns.data || []).filter((intern) => {
      if (!intern.school_id) return false;
      return !schoolIds.has(intern.school_id);
    });

    if (orphanInterns.length > 0) {
      const { error } = await db
        .from("intern_profiles")
        .update({ school_id: null })
        .in("id", orphanInterns.map(i => i.id));

      if (error) {
        throw new Error("Gagal cleanup orphan interns: " + error.message);
      }
      deletedCount += orphanInterns.length;
    }
  }

  await writeAuditLog(
    user.id,
    "cleanup_orphan_data",
    "system",
    null,
    null,
    { orphanType, deletedCount }
  );

  revalidatePath("/dashboard/super-admin/schools");
  revalidatePath("/dashboard/super-admin/users");
  
  // Server action untuk form submit tidak perlu mengembalikan payload.
}

export async function updateInternPeriodAction(formData: FormData) {
  const user = await requireSuperAdmin();
  const internId = formData.get("internId") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const major = formData.get("major") as string;
  const gradeOrSemester = formData.get("gradeOrSemester") as string;
  const rawStatus = formData.get("status");

  const parsed = updateInternPeriodSchema.safeParse({
    internId,
    status: typeof rawStatus === "string" && rawStatus ? rawStatus : undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Status magang tidak valid.");
  }

  const status = parsed.data.status ?? "active";

  if (usesLocalBackend()) {
    const response = await backendRequest(`/v1/super-admin/interns/${encodeURIComponent(parsed.data.internId)}/period`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ startDate: startDate || null, endDate: endDate || null, major: major || null, gradeOrSemester: gradeOrSemester || null, status }),
    });
    if (!response.ok) throw new Error("Gagal memperbarui periode magang pada backend lokal.");
    revalidatePath("/dashboard/super-admin/schools");
    revalidatePath("/dashboard/intern");
    revalidatePath("/dashboard/school/students");
    return;
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("intern_profiles")
    .update({
      start_date: startDate || null,
      end_date: endDate || null,
      major: major || null,
      grade_or_semester: gradeOrSemester || null,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.internId)
    .select("id");

  if (error) {
    // `error.message` TIDAK ikut disertakan: ia berisi teks mentah PostgreSQL
    // (nama kolom, nama constraint, nama enum) yang tidak membantu super admin
    // dan membocorkan bentuk skema ke antarmuka.
    console.error("Gagal memperbarui periode magang:", error);
    throw new Error("Gagal memperbarui periode magang.");
  }

  // M-2: `update` yang tidak mengenai satu baris pun mengembalikan `error: null`.
  if (!data || data.length === 0) {
    throw new Error("Periode magang tidak tersimpan: siswa tidak ditemukan.");
  }

  await writeAuditLog(
    user.id,
    "update_intern_period",
    "intern_profiles",
    internId,
    null,
    { startDate, endDate, major, gradeOrSemester, status }
  );

  revalidatePath("/dashboard/super-admin/schools");
  revalidatePath("/dashboard/intern");
  revalidatePath("/dashboard/school/students");
}

/**
 * Lengkapi profil domain yang belum ada untuk user yang sudah punya role.
 *
 * Pengganti eksplisit untuk pembuatan malas yang dulu terjadi di jalur GET.
 * Hanya menambah baris yang kurang: tidak menghapus, tidak mengubah, dan tidak
 * menyentuh penempatan atau data peserta yang sudah ada. 23505 ditangani di
 * provisionDomainProfile sebagai "sudah ada".
 */
export async function backfillDomainProfilesAction() {
  const user = await requireSuperAdmin();

  if (usesLocalBackend()) {
    const response = await backendRequest("/v1/super-admin/domain-profiles/backfill", { method: "POST" });
    if (!response.ok) throw new Error("Gagal melengkapi profil domain pada backend lokal.");
    revalidatePath("/dashboard/super-admin/users");
    revalidatePath("/dashboard/super-admin/orphan-cleanup");
    return;
  }

  const { missing, error } = await detectMissingDomainProfiles();

  if (error) {
    throw new Error("Gagal memeriksa profil yang belum lengkap.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  let created = 0;
  const failures: Array<{ userId: string; reason: string }> = [];

  for (const row of missing) {
    try {
      await provisionDomainProfile(db, row.userId, row.roleCode);
      created += 1;
    } catch (err) {
      // Satu user tanpa user_profiles tidak boleh menggagalkan sisanya.
      failures.push({
        userId: row.userId,
        reason: err instanceof Error ? err.message : "Tidak diketahui",
      });
    }
  }

  await writeAuditLog(
    user.id,
    "backfill_domain_profiles",
    "system",
    null,
    null,
    { attempted: missing.length, created, failed: failures.length, failures }
  );

  revalidatePath("/dashboard/super-admin/users");
  revalidatePath("/dashboard/super-admin/orphan-cleanup");
}
