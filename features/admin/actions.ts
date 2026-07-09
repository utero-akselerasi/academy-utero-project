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

export async function assignMentorAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user || !(await canAccessAdminDashboard(user.id))) {
    redirect("/login");
  }

  const internId = formData.get("internId") as string;
  const mentorId = formData.get("mentorId") as string;

  if (!internId || !mentorId) {
    throw new Error("Pilih peserta magang dan mentor.");
  }

  const db = await createUteroAcademyClient();
  const { error } = await db.from("mentor_assignments").insert({
    intern_id: internId,
    mentor_id: mentorId,
    assigned_by: user.id,
    started_at: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  });

  if (error) {
    console.error("Gagal assign mentor:", error);
    throw new Error("Gagal menyimpan penempatan magang.");
  }

  revalidatePath("/dashboard/admin/penempatan");
}

export async function removeMentorAssignmentAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user || !(await canAccessAdminDashboard(user.id))) {
    redirect("/login");
  }

  const assignmentId = formData.get("assignmentId") as string;

  if (!assignmentId) {
    throw new Error("ID penempatan tidak valid.");
  }

  const db = await createUteroAcademyClient();
  const { error } = await db.from("mentor_assignments").delete().eq("id", assignmentId);

  if (error) {
    console.error("Gagal hapus assignment:", error);
    throw new Error("Gagal menghapus penempatan magang.");
  }

  revalidatePath("/dashboard/admin/penempatan");
}
