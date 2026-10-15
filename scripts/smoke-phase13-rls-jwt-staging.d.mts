export function validateJwtSmokeConfig(env: Record<string, string | undefined>): true;
export function smokeJwtRlsStaging(env?: Record<string, string | undefined>, fetcher?: typeof fetch): Promise<Record<string, any>>;
