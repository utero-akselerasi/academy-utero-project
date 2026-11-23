import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth/guards";
import { getSelectionWorkspace } from "@/features/selection/queries";
import { SelectionTestStudio } from "@/features/selection/SelectionTestStudio";

export default async function SelectionTestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  await requireAdmin();
  const { testId } = await params;
  const workspace = await getSelectionWorkspace();
  if (!workspace.tests.some((test) => test.id === testId)) notFound();
  return <main className="w-full px-3 py-3 sm:px-4 sm:py-4"><SelectionTestStudio tracks={workspace.tracks} tests={workspace.tests} questions={workspace.questions} detailTestId={testId} /></main>;
}
