export interface ProductionPreflightConfig {
  baseUrl: string;
  healthPath: string;
  minCertDays: number;
  timeoutMs: number;
  output: string;
}

export interface ProductionPreflightReport {
  schemaVersion: 1;
  gate: "tlsPreflight";
  target: "production";
  mode: "unauthenticated-read-only";
  startedAt: string;
  finishedAt: string;
  expiresAt: string;
  status: "PASS" | "FAIL";
  subject: { origin: string; hostname: string; healthPath: string };
  policy: { minCertDays: number; timeoutMs: number };
  checks: Record<string, { ok: boolean; [key: string]: unknown }>;
}

export type ProductionPreflightFetcher = (input: URL, init: RequestInit) => Promise<Response>;

export function parseProductionPreflightArgs(args: ["--help"]): { help: true };
export function parseProductionPreflightArgs(args: string[]): ProductionPreflightConfig;
export function inspectSecurityHeaders(headers: Headers): Record<string, { present: boolean; valid: boolean }>;
export function runProductionPreflight(config: ProductionPreflightConfig, dependencies?: {
  now?: () => Date;
  fetch?: ProductionPreflightFetcher;
  tlsProbe?: (hostname: string, port: number, timeoutMs: number) => Promise<{
    validFrom: string; validTo: string; fingerprint256?: string;
  }>;
}): Promise<ProductionPreflightReport>;
export function writeProductionPreflightReport(report: ProductionPreflightReport, output: string): Promise<{
  path: string; sizeBytes: number; sha256: string;
}>;
