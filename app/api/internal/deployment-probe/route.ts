import { probeStagingDeployment } from "@/lib/deployment-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return probeStagingDeployment(request);
}
