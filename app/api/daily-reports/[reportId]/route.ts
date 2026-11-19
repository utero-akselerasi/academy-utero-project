import { requireRouteAdmin, RouteAuthorizationError } from "@/features/auth/guards";
import { resolveStaffInternScope } from "@/features/auth/scope";
import { getStaffDailyReportDetail } from "@/features/daily-reports/queries";
import { usesLocalBackend } from "@/lib/backend/mode";

type RouteProps = { params: Promise<{ reportId: string }> };

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const user = await requireRouteAdmin();
    const { reportId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reportId)) {
      return Response.json({ error: "invalid_report_id" }, { status: 400 });
    }
    const scope = usesLocalBackend() ? null : await resolveStaffInternScope(user.id);
    if (scope?.kind === "setup_required") return Response.json({ error: "setup_required" }, { status: 409 });
    const report = await getStaffDailyReportDetail(reportId, !scope || scope.kind === "global" ? null : scope.internIds);
    if (!report) return Response.json({ error: "report_not_found" }, { status: 404 });
    return Response.json({ report }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RouteAuthorizationError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
