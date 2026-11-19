export interface ProductionReadinessOptions {
  envFile?: string;
  checklist?: string;
}

export interface ProductionReadinessCheck {
  status: "PASS" | "FAIL";
  [key: string]: unknown;
}

export interface ProductionReadinessReport {
  status: "PASS" | "NO-GO";
  mode: "read-only-local";
  networkAccess: false;
  checks: {
    environment: ProductionReadinessCheck;
    evidence: ProductionReadinessCheck;
  };
}

export function parseProductionReadinessArgs(args: string[]): ProductionReadinessOptions | { help: true };

export function buildProductionReadinessSummary(options: ProductionReadinessOptions, dependencies?: {
  evaluateGate?: (checklist: string) => Promise<{ decision: string; evidenceCount: number }>;
  validateEnv?: (env: Record<string, string>) => Promise<{ ready: true; checks: string[] }>;
}): Promise<ProductionReadinessReport>;
