import { backendRequest } from "@/lib/backend/server";

export type AcademyProgram = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
};

export async function getAdminPrograms() {
  const response = await backendRequest("/v1/admin/programs");
  if (!response.ok) throw new Error("Daftar program belum dapat dimuat.");
  return (await response.json()) as { programs: AcademyProgram[] };
}
