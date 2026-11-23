"use server";

import { type ApplicationStatus } from "@/features/admin/types";
import { requireAdmin } from "@/features/auth/guards";
import { createUteroAcademyClient } from "@/lib/supabase/server";
import { usesLocalBackend } from "@/lib/backend/server";
import { approveLocalOnboarding, updateLocalApplication } from "./local";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/features/auth/guards";
import { backendRequest } from "@/lib/backend/server";

const updateApplicationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewed", "accepted", "rejected", "cancelled"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
    revalidatePath("/dashboard/admin/pendaftaran/" + parsed.data.id);
    return;
  }
  const db = await createUteroAcademyClient();
  if (status === "accepted") {
    const dates = z.object({ startDate: z.string().date(), endDate: z.string().date() }).refine((value) => value.endDate >= value.startDate).safeParse(parsed.data);
    if (!dates.success) throw new Error("Tanggal magang resmi wajib valid.");
    const { error } = await db.rpc("accept_application_as_intern", { p_application_id: parsed.data.id, p_start_date: dates.data.startDate, p_end_date: dates.data.endDate });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/admin/pendaftaran");
    revalidatePath("/dashboard/admin/pendaftaran/" + parsed.data.id);
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
  revalidatePath("/dashboard/admin/pendaftaran/" + parsed.data.id);
}

export async function approveApplicationOnboardingAction(formData: FormData) {
  await requireStaff();
  const parsed = approveOnboardingSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Pendaftaran tidak valid.");

  if (usesLocalBackend()) {
    await approveLocalOnboarding(parsed.data.id);
    revalidatePath("/dashboard/admin/pendaftaran");
    revalidatePath("/dashboard/admin/pendaftaran/" + parsed.data.id);
    return;
  }

  const db = await createUteroAcademyClient();
  const { error } = await db.rpc("approve_application_onboarding", {
    p_application_id: parsed.data.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/pendaftaran");
  revalidatePath("/dashboard/admin/pendaftaran/" + parsed.data.id);
}

export type ApplicationStatusActionState = { ok: boolean; message: string };

export async function updateApplicationPeriodAction(_previousState: ApplicationStatusActionState, formData: FormData): Promise<ApplicationStatusActionState> {
  await requireSuperAdmin();
  const parsed = z.object({
    id: z.string().uuid(),
    startDate: z.string().date(),
    endDate: z.string().date(),
  }).refine((value) => value.endDate >= value.startDate).safeParse({
    id: formData.get("id"), startDate: formData.get("startDate"), endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { ok: false, message: "Tanggal mulai dan selesai tidak valid." };
  if (!usesLocalBackend()) return { ok: false, message: "Perubahan periode harus dilakukan melalui backend Academy." };
  try {
    const response = await backendRequest(`/v1/super-admin/applications/${parsed.data.id}/period`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ startDate: parsed.data.startDate, endDate: parsed.data.endDate }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      return { ok: false, message: result.error === "intern_profile_not_created" ? "Profil peserta magang belum dibuat; periode belum bisa diubah." : "Periode belum berhasil diperbarui." };
    }
    revalidatePath("/dashboard/admin/pendaftaran");
    revalidatePath(`/dashboard/admin/pendaftaran/${parsed.data.id}`);
    revalidatePath("/dashboard/applicant");
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard/intern");
    return { ok: true, message: "Periode magang diperbarui dan perubahan tercatat." };
  } catch {
    return { ok: false, message: "Periode belum berhasil diperbarui. Coba lagi." };
  }
}

export async function updateApplicationStatusFormAction(
  _previousState: ApplicationStatusActionState,
  formData: FormData,
): Promise<ApplicationStatusActionState> {
  await requireStaff();
  try {
    await updateApplicationStatusAction(formData);
    return { ok: true, message: "Status pendaftaran berhasil diperbarui." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("selection_not_passed") || message.includes("Peserta belum dinyatakan lolos seleksi")) {
      return { ok: false, message: "Pelamar belum lolos seleksi. Selesaikan atau bypass seleksi sebelum menerima pelamar." };
    }
    if (message.includes("Tanggal magang resmi wajib valid")) {
      return { ok: false, message: "Tanggal mulai dan selesai magang tidak valid." };
    }
    console.error("Gagal memperbarui status pendaftaran:", error);
    return { ok: false, message: "Status belum berhasil disimpan. Coba lagi." };
  }
}
