import { describe, expect, it } from "vitest";

type EnvValues = Record<string, string>;
type TargetMarker = { target: string; supabaseUrl: string; appUrl: string; anonKeyDigest: string };
const verifierModule = "../scripts/verify-supabase-target.mjs";
const { parseBuildEnv, verifyTarget } = await import(verifierModule) as {
  parseBuildEnv(content: string): EnvValues;
  verifyTarget(target: string, values: EnvValues, options?: { build?: boolean }): TargetMarker;
};

const developEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.carubra.com",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "develop-anon-key",
  NEXT_PUBLIC_APP_URL: "https://academy-dev.carubra.com",
};

describe("verifyTarget", () => {
  it("menerima domain develop yang tepat", () => {
    expect(verifyTarget("develop", developEnv)).toMatchObject({
      target: "develop",
      supabaseUrl: "https://supabase.carubra.com",
    });
  });

  it("menerima domain production yang tepat", () => {
    expect(verifyTarget("production", {
      ...developEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.carubra.space",
    })).toMatchObject({ target: "production", supabaseUrl: "https://supabase.carubra.space" });
  });

  it.each([
    ["production", developEnv],
    ["develop", { ...developEnv, NEXT_PUBLIC_SUPABASE_URL: "https://supabase.carubra.space" }],
    ["develop", { ...developEnv, NEXT_PUBLIC_SUPABASE_URL: "http://supabase.carubra.com" }],
    ["develop", { ...developEnv, NEXT_PUBLIC_SUPABASE_URL: "https://supabase.carubra.com/path" }],
    ["staging", developEnv],
  ])("menolak target atau URL yang tidak cocok", (target, values) => {
    expect(() => verifyTarget(target, values)).toThrow();
  });

  it("menolak env wajib yang kosong", () => {
    expect(() => verifyTarget("develop", { ...developEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" })).toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi",
    );
  });

  it.each(["SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"])('menolak secret "%s" pada env build', (key) => {
    expect(() => verifyTarget("develop", { ...developEnv, [key]: "secret" })).toThrow(
      "Env build tidak boleh memuat kredensial server atau database",
    );
  });
});

describe("parseBuildEnv", () => {
  it("membaca env tanpa mengekspos nilai lewat API lain", () => {
    expect(parseBuildEnv('NEXT_PUBLIC_SUPABASE_URL="https://supabase.carubra.com"\nNEXT_PUBLIC_SUPABASE_ANON_KEY=key\n')).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://supabase.carubra.com",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "key",
    });
  });

  it("menolak key duplikat", () => {
    expect(() => parseBuildEnv("NEXT_PUBLIC_APP_URL=https://a.test\nNEXT_PUBLIC_APP_URL=https://b.test")).toThrow();
  });
});
