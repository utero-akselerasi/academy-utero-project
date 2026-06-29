"use server";

import { userHasAnyRole } from "@/features/auth/roles";
import { createSupabaseServerClient, createUteroAcademyClient } from "@/lib/supabase/server";
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

  const allowed = await userHasAnyRole(user.id, ["super_admin"]);

  if (!allowed) {
    redirect("/login");
  }

  return user;
}

export async function assignUserRoleAction(formData: FormData) {
  await requireSuperAdmin();

  const parsed = assignRoleSchema.safeParse({
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
  });

  if (!parsed.success) {
    throw new Error("Data role tidak valid.");
  }

  const db = await createUteroAcademyClient();
  const { error } = await db.from("user_roles").insert({
    user_id: parsed.data.userId,
    role_id: parsed.data.roleId,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/super-admin/users");
}

export async function removeUserRoleAction(formData: FormData) {
  await requireSuperAdmin();

  const id = z.string().uuid().parse(formData.get("id"));
  const db = await createUteroAcademyClient();
  const { error } = await db.from("user_roles").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/super-admin/users");
}

