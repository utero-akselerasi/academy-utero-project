import { describe, expect, it } from "vitest";

const { validateReplacementManifest } = await import("../scripts/preflight-phase13-rollback-replacement.mjs") as {
  validateReplacementManifest: (manifest: Record<string, unknown>) => string;
};
const project = "supabase-02-rollback-drill";
const root = `/data/supabase/instances/${project}`;
const valid = { sourceInstance: "supabase-02", project, root, gatewayPort: 8200, databasePort: 5632,
  mounts: [`${root}/db`, `${root}/storage`], containers: [`${project}-db`, `${project}-auth`],
  images: [`sha256:${"a".repeat(64)}`] };

describe("preflight replacement", () => {
  it("menerima identitas volume terpisah", () => {
    expect(validateReplacementManifest(valid)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("menerima fallback home maskhar yang terisolasi", () => {
    const fallbackRoot = `/home/maskhar/supabase-replacements/${project}`;
    expect(validateReplacementManifest({ ...valid, root: fallbackRoot,
      mounts: [`${fallbackRoot}/config/volumes/db/data`, `${fallbackRoot}/config/volumes/storage`] }))
      .toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    { mounts: ["/data/supabase/instances/supabase-02/config/volumes/db/data", `${root}/storage`] },
    { mounts: ["/data/supabase/instances/supabase-01/db", `${root}/storage`] },
    { mounts: [`${root}/../supabase-02/db`, `${root}/storage`] },
    { gatewayPort: 8100 }, { databasePort: 5532 },
    { containers: ["supabase-02-db"] },
    { project: "supabase-02" },
    { root: `/home/maskhar/${project}`, mounts: [`/home/maskhar/${project}/db`, `/home/maskhar/${project}/storage`] },
  ])("menolak target/source collision", (override) => {
    expect(() => validateReplacementManifest({ ...valid, ...override })).toThrow();
  });

});
