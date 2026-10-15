export function validateBindingConfig(env: Record<string, string | undefined>): { app: string };
export function verifyAppBinding(
  env?: Record<string, string | undefined>, fetcher?: typeof fetch,
): Promise<{ appHttp: "passed"; browserSupabaseBinding: "passed" | "failed"; serverRuntimeBinding: "passed" | "failed"; bindingProven: boolean }>;
