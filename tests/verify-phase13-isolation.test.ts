import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const modulePath = "../scripts/verify-phase13-isolation.mjs";
const { BASELINE_VERSIONS, verifyIsolation } = await import(modulePath) as {
  BASELINE_VERSIONS: string[];
  verifyIsolation(snapshot: Record<string, unknown>): { ready: boolean; errors: string[] };
};

type Policy = {
  policyname: string;
  cmd: string;
  roles: string[];
  bucket: string | null;
  qual: string | null;
  with_check: string | null;
};

type SmokeEvidence = {
  bucket: string;
  path: string;
  status: number;
  size: number;
  sha256: string;
  expectedSha256: string;
};

type IsolationSnapshot = {
  buckets: Array<{ id: string; public: boolean; file_size_limit: number }>;
  policies: Policy[];
  soundpubPolicyDigest: string;
  versions: string[];
  smoke: SmokeEvidence[];
};

const soundpubPolicy: Policy = {
  policyname: "SoundPub avatar read", cmd: "SELECT", roles: ["anon"], bucket: "avatars",
  qual: "bucket_id = 'avatars'", with_check: null,
};

function validSnapshot(): IsolationSnapshot {
  const fingerprint = [{ policyname: soundpubPolicy.policyname, cmd: soundpubPolicy.cmd, roles: soundpubPolicy.roles,
    qual: soundpubPolicy.qual, with_check: soundpubPolicy.with_check }];
  return {
    buckets: [{ id: "academy-private", public: false, file_size_limit: 20971520 }],
    policies: [soundpubPolicy, { policyname: "Academy read", cmd: "SELECT", roles: ["authenticated"],
      bucket: "academy-private", qual: "bucket_id = 'academy-private'", with_check: null }],
    soundpubPolicyDigest: createHash("sha256").update(JSON.stringify(fingerprint)).digest("hex"),
    versions: [...BASELINE_VERSIONS, "0038", "0047"],
    smoke: [{ bucket: "academy-private", path: "avatar/user.jpg", status: 200, size: 3,
      sha256: "a".repeat(64), expectedSha256: "a".repeat(64) }],
  };
}

describe("verifier isolasi Storage fase 13", () => {
  it("menerima bukti lengkap tanpa mengharuskan baseline menjadi migrasi terakhir", () => {
    expect(verifyIsolation(validSnapshot())).toEqual({ ready: true, errors: [] });
  });

  it("gagal bila bucket Academy publik atau batas ukuran berubah", () => {
    const snapshot = validSnapshot();
    snapshot.buckets = [{ id: "academy-private", public: true, file_size_limit: 1 }];
    expect(verifyIsolation(snapshot).errors).toContain("Konfigurasi academy-private tidak sesuai");
  });

  it("gagal bila policy global, policy tulis Academy, atau policy SoundPub berubah", () => {
    const snapshot = validSnapshot();
    snapshot.policies.push({ policyname: "Public Access", cmd: "SELECT", roles: ["anon"], bucket: null,
      qual: "true", with_check: null });
    snapshot.policies.push({ policyname: "Academy write", cmd: "INSERT", roles: ["authenticated"],
      bucket: "academy-private", qual: null, with_check: "true" });
    expect(verifyIsolation(snapshot).errors).toEqual(expect.arrayContaining([
      "Policy Storage global terbuka", "Policy tulis bucket Academy terbuka",
    ]));
  });

  it("gagal bila fingerprint policy SoundPub berubah", () => {
    const snapshot = validSnapshot();
    snapshot.policies[0] = { ...snapshot.policies[0], qual: "bucket_id = 'avatars' and false" };
    expect(verifyIsolation(snapshot).errors).toContain("Policy SoundPub berubah atau fingerprint tidak ada");
  });

  it("gagal bila satu versi baseline hilang", () => {
    const snapshot = validSnapshot();
    snapshot.versions = snapshot.versions.filter((version) => version !== "0032b");
    expect(verifyIsolation(snapshot).errors).toContain("Riwayat baseline 0001–0037 tidak lengkap");
  });

  const invalidSmokeCases: Array<[SmokeEvidence[]]> = [
    [[]],
    [[{ bucket: "avatars", path: "x", status: 200, size: 1, sha256: "a".repeat(64), expectedSha256: "a".repeat(64) }]],
    [[{ bucket: "academy-private", path: "x", status: 403, size: 1, sha256: "a".repeat(64), expectedSha256: "a".repeat(64) }]],
    [[{ bucket: "daily-report", path: "x", status: 200, size: 1, sha256: "a".repeat(64), expectedSha256: "b".repeat(64) }]],
  ];

  it.each(invalidSmokeCases)("gagal untuk bukti smoke yang tidak valid", (smoke) => {
    const snapshot = validSnapshot();
    snapshot.smoke = smoke;
    expect(verifyIsolation(snapshot).errors).toContain("Smoke object Storage gagal atau bukti tidak lengkap");
  });
});

describe("baseline repo 0001–0037", () => {
  it("sinkron dengan daftar migrasi verifier", () => {
    const versions = readdirSync(resolve(process.cwd(), "supabase/migrations"))
      .flatMap((name) => /^((?:00(?:0[1-9]|[12][0-9]|3[0-7]))[a-z]?)_.+\.sql$/.exec(name)?.slice(1, 2) ?? [])
      .sort();
    expect(versions).toEqual([...BASELINE_VERSIONS].sort());
  });
});
