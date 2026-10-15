export type ProductionEnvironment = Record<string, string | undefined>;

export interface ProductionEnvironmentReport {
  ready: true;
  checks: string[];
}

export function parseEnvFile(content: string): Record<string, string>;
export function parseCliArgs(args: string[]): { envFile: string };
export function validateComposeCookieOverrides(composeText: string): true;
export function validateSelfhostedProductionEnv(
  env: ProductionEnvironment,
  options?: { composeText?: string },
): Promise<ProductionEnvironmentReport>;
