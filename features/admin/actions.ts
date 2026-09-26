"use server";

import { type ApplicationStatus } from "@/features/admin/types";
import { requireAdmin } from "@/features/auth/guards";
import { createUteroAcademyClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateApplicationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewed", "accepted", "rejected", "cancelled"]),
});

const assignMentorSchema = z.object({
  internId: z.string().uuid("Peserta magang tidak valid."),
  mentorId: z.string().uuid("Mentor tidak valid."),
});

// Guard terpusat: guard lama memakai canAccessAdminDashboard() yang hanya
// mengizinkan role "admin" sehingga super_admin ikut ditolak, dan mengarahkan
// user dengan role salah ke /login bukan ke halaman 403.
const requireStaff = requireAdmin;

export async function updateApplicationStatusAction(formData: FormData) {
  const user = await requireStaff();

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
  const user = await requireStaff();

  const parsed = assignMentorSchema.safeParse({
    internId: formData.get("internId"),
    mentorId: formData.get("mentorId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Pilih peserta magang dan mentor.");
  }

  const db = await createUteroAcademyClient();
  const { error } = await db.from("mentor_assignments").insert({
    intern_id: parsed.data.internId,
    mentor_id: parsed.data.mentorId,
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
  await requireStaff();

  const parsedId = z.string().uuid().safeParse(formData.get("assignmentId"));

  if (!parsedId.success) {
    throw new Error("ID penempatan tidak valid.");
  }

  const db = await createUteroAcademyClient();
  const { error } = await db.from("mentor_assignments").delete().eq("id", parsedId.data);

  if (error) {
    console.error("Gagal hapus assignment:", error);
    throw new Error("Gagal menghapus penempatan magang.");
  }

  revalidatePath("/dashboard/admin/penempatan");
}
