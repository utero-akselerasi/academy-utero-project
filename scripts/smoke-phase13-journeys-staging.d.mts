export type JourneySmokeStatus = "passed" | "failed" | "untested";

export function validateStaging(env: Record<string, string | undefined>): {
  base: string;
  sample: string | undefined;
};

export function smokeJourneys(
  env?: Record<string, string | undefined>,
  fetcher?: typeof fetch,
): Promise<Record<string, JourneySmokeStatus>>;

export function smokeComplete(result: Record<string, JourneySmokeStatus>): boolean;
