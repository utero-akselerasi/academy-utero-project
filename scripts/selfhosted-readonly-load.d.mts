export interface ReadonlyLoadConfig {
  baseUrl: string;
  target: "local" | "production";
  paths: string[];
  requests: number;
  concurrency: number;
  timeoutMs: number;
  p95BudgetMs: number;
  maxErrorRate: number;
  output?: string;
}

export interface ReadonlyLoadReport {
  schemaVersion: 1;
  gate: "readonlyUatPerformance";
  target: "local" | "production";
  mode: "unauthenticated-read-only";
  startedAt: string;
  finishedAt: string;
  status: "PASS" | "FAIL";
  limits: Record<string, number>;
  result: {
    completed: number;
    failed: number;
    errorRate: number;
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
    maxMs: number;
    statusCounts: Record<string, number>;
    paths: Record<string, { requests: number; failures: number; p95Ms: number | null }>;
  };
}

export type ReadonlyLoadFetcher = (input: URL, init: RequestInit) => Promise<Response>;

export function parseReadonlyLoadArgs(args: ["--help"]): { help: true };
export function parseReadonlyLoadArgs(args: string[]): ReadonlyLoadConfig;
export function runReadonlyLoad(config: ReadonlyLoadConfig, dependencies?: {
  fetch?: ReadonlyLoadFetcher;
  clock?: () => number;
  now?: () => Date;
}): Promise<ReadonlyLoadReport>;
export function writeReadonlyLoadReport(report: ReadonlyLoadReport, output?: string): Promise<{
  content?: string;
  path?: string;
  sha256: string;
}>;
