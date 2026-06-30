"use server";

import { userHasAnyRole } from "@/features/auth/roles";
import { createSupabaseServerClient, createUteroAcademyClient, createSupabaseServiceRoleClient, createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditLog } from "./audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

async function requireSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const allowed = await userHasAnyRole(user.id, ["admin"]);

  if (!allowed) {
    redirect("/login");
  }

  return user;
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

  revalidatePath("/dashboard/super-admin/users");
}

export async function removeUserRoleAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const id = z.string().uuid().parse(formData.get("id"));
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
  const user = await requireSuperAdmin();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const phone = formData.get("phone") as string;
  const roleId = formData.get("roleId") as string;

  if (!email || !password || !fullName) {
    throw new Error("Email, password, dan nama lengkap wajib diisi.");
  }

  const supabase = createSupabaseServiceRoleClient();
  
  // Create user in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (authError) {
    console.error("Gagal create user auth:", authError);
    throw new Error("Gagal membuat user di Auth: " + authError.message);
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("User ID tidak ditemukan setelah pembuatan.");
  }

  const db = await createUteroAcademyServiceRoleClient();
  
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

    if (roleData) {
      if (roleData.code === "intern") {
        await db.from("intern_profiles").insert({
          user_id: userId,
          full_name: fullName,
          phone: phone || null,
          email: email,
          status: "active"
        });
      } else if (roleData.code === "mentor" || roleData.code === "admin") {
        // Auto-create mentor_profile agar admin bisa ditugaskan membimbing siswa magang
        await db.from("mentor_profiles").insert({
          user_id: userId
        });
      }
    }
  }

  revalidatePath("/dashboard/super-admin/users");
}
