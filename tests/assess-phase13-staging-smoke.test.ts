import { describe, expect, it } from "vitest";
import { assessStagingSmoke, EXPECTED_LATEST_MIGRATION, REQUIRED_BUCKETS } from "../scripts/assess-phase13-staging-smoke.mjs";

const complete = {
  target: "staging", instance: "supabase-02", gateway: "127.0.0.1:8100",
  backup: { hashesVerified: true, provenanceVerified: true, restoredStateVerified: true },
  tracker: { present: true, latest: EXPECTED_LATEST_MIGRATION, checksumsVerified: true }, buckets: [...REQUIRED_BUCKETS],
  app: { bindingProven: true, serverRuntimeBinding: "passed" },
  cleanup: { auth: true, database: true, storage: true, zeroResidue: true }, e2e: {},
};

describe("assess staging smoke", () => {
  it("tidak mengizinkan fixture dari klaim evidence yang tidak diaudit", () => {
    expect(assessStagingSmoke(complete)).toMatchObject({ status: "EVIDENCE_CLAIMED_NOT_VERIFIED", fixtureAllowed: false,
      smokeAllowed: false, blockers: ["independentProof"] });
  });

  it("gagal tertutup untuk bukti aktual yang belum lengkap", () => {
    const result = assessStagingSmoke({ ...complete,
      backup: { hashesVerified: true, provenanceVerified: false, restoredStateVerified: false },
      tracker: { present: false }, buckets: ["academy-private", "daily-report", "selection-answers"],
      app: { bindingProven: false, serverRuntimeBinding: "untested" },
      cleanup: { auth: false, database: false, storage: false, zeroResidue: false },
    });
    expect(result.status).toBe("NO-GO");
    expect(result.blockers).toEqual(["backup", "tracker", "buckets", "appBinding", "cleanup"]);
    expect(result.fixtureAllowed).toBe(false);
  });

  it("menolak tracker lama setelah hardening dan semantic reassertion", () => {
    expect(assessStagingSmoke({ ...complete, tracker: { present: true, latest: "0050", checksumsVerified: true } }).gates.tracker).toBe(false);
  });
});
