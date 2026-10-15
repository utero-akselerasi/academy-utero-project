export function validateRlsTarget(databaseUrl: string, expectedDatabase: string): string;
export function assessRlsMatrix(principals: Record<string, any>): { ready: boolean; checks: Record<string, boolean> };
export function auditRlsMatrix(databaseUrl: string, expectedDatabase: string, Client?: any): Promise<Record<string, any>>;
