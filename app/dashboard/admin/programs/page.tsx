import { ProgramsManager } from "@/features/admin/ProgramsManager";
import { getAdminPrograms } from "@/features/admin/programs";
import { requireAdmin } from "@/features/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminProgramsPage() {
  await requireAdmin();
  const { programs } = await getAdminPrograms();
  return <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8"><ProgramsManager programs={programs} /></main>;
}
