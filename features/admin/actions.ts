"use server";

import { canAccessAdminDashboard, getCurrentUser } from "@/features/admin/auth";
import { type ApplicationStatus } from "@/features/admin/types";
import { createUteroAcademyClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const updateApplicationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewed", "accepted", "rejected", "cancelled"]),
});

export async function updateApplicationStatusAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user || !(await canAccessAdminDashboard(user.id))) {
    redirect("/login");
  }

  const parsed = updateApplicationSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    throw new Error("Status pendaftaran tidak valid.");
  }

  const db = await createUteroAcademyClient();
  const status = parsed.data.status satisfies ApplicationStatus;
  const { error } = await db
    .from("internship_applications")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) {
    throw new Error("Status belum berhasil diubah.");
  }

  revalidatePath("/dashboard/admin/pendaftaran");
}
