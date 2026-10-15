import { describe, expect, it } from "vitest";
import { buildFixturePlan, fixtureBlockers } from "../scripts/plan-phase13-staging-fixture.mjs";

const env = { DEPLOY_TARGET: "staging", SUPABASE_STAGING_URL: "http://127.0.0.1:18100", SUPABASE_STAGING_SERVICE_ROLE_KEY: "service", SUPABASE_STAGING_ANON_KEY: "anon" };
const evidence = { instance: "supabase-02", gateway: "127.0.0.1:8100", database: "supabase-02-db", volume: "/data/supabase/instances/supabase-02/config/volumes/db/data", serviceKeyAccepted: true, serviceKeySource: "supabase-02-envoy", appBinding: "passed", cleanup: { auth: true, database: true, storage: true, zeroResidue: true } };

describe("staging fixture plan", () => {
  it("menghasilkan identitas sintetis dan cleanup exact-marker tanpa write", () => {
    const plan = buildFixturePlan(env, evidence, "00000000-0000-4000-8000-000000000001");
    expect(plan).toMatchObject({ marker: "phase13-smoke-00000000-0000-4000-8000-000000000001", executable: false });
    expect(JSON.stringify(plan)).toContain("@invalid.example");
    expect(JSON.stringify(plan)).toContain("exact prefix");
  });

  it("menolak bila binding, identity, key, atau cleanup belum terbukti", () => {
    for (const patch of [{ appBinding: "failed" }, { instance: "supabase-01" }, { serviceKeyAccepted: false }, { serviceKeySource: "unknown" }, { cleanup: { ...evidence.cleanup, zeroResidue: false } }]) {
      expect(() => buildFixturePlan(env, { ...evidence, ...patch })).toThrow();
    }
    expect(() => buildFixturePlan({ ...env, DEPLOY_TARGET: "production" }, evidence)).toThrow();
  });

  it("melaporkan blocker konkret tanpa mengakses production", () => {
    expect(fixtureBlockers(env, { ...evidence, appBinding: "failed", cleanup: { auth: false, database: false, storage: false, zeroResidue: false } })).toEqual([
      "binding app staging belum lulus",
      "cleanup Auth/DB/Storage dan zero-residue belum terbukti",
    ]);
  });
});
