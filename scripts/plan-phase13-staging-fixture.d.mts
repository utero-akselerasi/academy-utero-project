export type FixtureEvidence = { instance: string; gateway: string; database: string; volume: string; serviceKeyAccepted: boolean; serviceKeySource: string; appBinding: string; cleanup: { auth: boolean; database: boolean; storage: boolean; zeroResidue: boolean } };
export function validateFixtureGate(env: Record<string, string | undefined>, evidence: FixtureEvidence): void;
export function fixtureBlockers(env: Record<string, string | undefined>, evidence: Partial<FixtureEvidence>): string[];
export function buildFixturePlan(env: Record<string, string | undefined>, evidence: FixtureEvidence, id?: string): Record<string, unknown>;
