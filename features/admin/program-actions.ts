"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/auth/guards";
import { backendRequest } from "@/lib/backend/server";

const programSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3, "Nama program minimal 3 karakter.").max(150),
  slug: z.string().trim().max(180).optional(),
  description: z.string().trim().max(5000).optional(),
  type: z.string().trim().min(1).max(80),
  status: z.enum(["draft", "published", "archived"]),
});

export type ProgramActionState = { ok: boolean; message: string };

export async function saveProgramAction(_: ProgramActionState, formData: FormData): Promise<ProgramActionState> {
  await requireAdmin();
  const parsed = programSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"), slug: formData.get("slug"),
    description: formData.get("description"), type: formData.get("type"), status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data program tidak valid." };

  const { id, ...program } = parsed.data;
  const response = await backendRequest(id ? `/v1/admin/programs/${id}` : "/v1/admin/programs", {
    method: id ? "PATCH" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(program),
  });
  if (response.status === 409) return { ok: false, message: "Slug sudah dipakai program lain." };
  if (!response.ok) return { ok: false, message: "Program belum berhasil disimpan. Periksa data dan coba lagi." };
  revalidatePath("/dashboard/admin/programs");
  revalidatePath("/dashboard/applicant");
  return { ok: true, message: id ? "Perubahan program tersimpan." : "Program berhasil ditambahkan." };
}
