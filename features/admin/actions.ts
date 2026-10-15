"use server";

import { type ApplicationStatus } from "@/features/admin/types";
import { requireAdmin } from "@/features/auth/guards";
import { createUteroAcademyClient } from "@/lib/supabase/server";
import { usesLocalBackend } from "@/lib/backend/server";
import { approveLocalOnboarding, createLocalPlacement, deleteLocalPlacement, updateLocalApplication } from "./local";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateApplicationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewed", "accepted", "rejected", "cancelled"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const assignMentorSchema = z.object({
  internId: z.string().uuid("Peserta magang tidak valid."),
  mentorId: z.string().uuid("Mentor tidak valid."),
});

const approveOnboardingSchema = z.object({
  id: z.string().uuid("Pendaftaran tidak valid."),
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
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
  });

  if (!parsed.success) {
    throw new Error("Status pendaftaran tidak valid.");
  }

  const status = parsed.data.status satisfies ApplicationStatus;
  if (usesLocalBackend()) {
    await updateLocalApplication(parsed.data.id, { status, startDate: parsed.data.startDate, endDate: parsed.data.endDate });
    revalidatePath("/dashboard/admin/pendaftaran");
    return;
  }
  const db = await createUteroAcademyClient();
  if (status === "accepted") {
    const dates = z.object({ startDate: z.string().date(), endDate: z.string().date() }).refine((value) => value.endDate >= value.startDate).safeParse(parsed.data);
    if (!dates.success) throw new Error("Tanggal magang resmi wajib valid.");
    const { error } = await db.rpc("accept_application_as_intern", { p_application_id: parsed.data.id, p_start_date: dates.data.startDate, p_end_date: dates.data.endDate });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/admin/pendaftaran");
    return;
  }
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

export async function approveApplicationOnboardingAction(formData: FormData) {
  await requireStaff();
  const parsed = approveOnboardingSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Pendaftaran tidak valid.");

  if (usesLocalBackend()) {
    await approveLocalOnboarding(parsed.data.id);
    revalidatePath("/dashboard/admin/pendaftaran");
    return;
  }

  const db = await createUteroAcademyClient();
  const { error } = await db.rpc("approve_application_onboarding", {
    p_application_id: parsed.data.id,
  });
  if (error) throw new Error(error.message);
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

  if (usesLocalBackend()) {
    await createLocalPlacement(parsed.data);
    revalidatePath("/dashboard/admin/penempatan");
    return;
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

  if (usesLocalBackend()) {
    await deleteLocalPlacement(parsedId.data);
    revalidatePath("/dashboard/admin/penempatan");
    return;
  }

  const db = await createUteroAcademyClient();
  const { error } = await db.from("mentor_assignments").delete().eq("id", parsedId.data);

  if (error) {
    console.error("Gagal hapus assignment:", error);
    throw new Error("Gagal menghapus penempatan magang.");
  }

  revalidatePath("/dashboard/admin/penempatan");
}
