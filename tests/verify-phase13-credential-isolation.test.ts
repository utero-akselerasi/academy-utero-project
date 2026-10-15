import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_ENV_NAMES,
  verifyCredentialIsolation,
} from "../scripts/verify-phase13-credential-isolation.mjs";

const validEnv = {
  PHASE13_DEV_JWT_SECRET: "dev-jwt-secret-value",
  PHASE13_PROD_JWT_SECRET: "prod-jwt-secret-value",
  PHASE13_DEV_SUPABASE_SERVICE_ROLE_KEY: "dev-service-role-value",
  PHASE13_PROD_SUPABASE_SERVICE_ROLE_KEY: "prod-service-role-value",
  PHASE13_DEV_SUPABASE_ANON_KEY: "dev-anon-value",
  PHASE13_PROD_SUPABASE_ANON_KEY: "prod-anon-value",
};

describe("phase 13 credential isolation verifier", () => {
  it("accepts complete isolated credentials", () => {
    expect(verifyCredentialIsolation(validEnv)).toBe(true);
  });

  it.each([
    ["JWT secret", "PHASE13_DEV_JWT_SECRET", "PHASE13_PROD_JWT_SECRET"],
    ["service-role key", "PHASE13_DEV_SUPABASE_SERVICE_ROLE_KEY", "PHASE13_PROD_SUPABASE_SERVICE_ROLE_KEY"],
    ["anon key", "PHASE13_DEV_SUPABASE_ANON_KEY", "PHASE13_PROD_SUPABASE_ANON_KEY"],
  ])("rejects identical dev/prod %s", (_label, devName, prodName) => {
    expect(verifyCredentialIsolation({ ...validEnv, [prodName]: validEnv[devName as keyof typeof validEnv] })).toBe(false);
  });

  it.each(CREDENTIAL_ENV_NAMES.map((name) => [name] as const))("fails closed when %s is missing", (name) => {
    const env: Record<string, string | undefined> = { ...validEnv };
    delete env[name];
    expect(verifyCredentialIsolation(env)).toBe(false);
  });

  it("prints only generic NO-GO on failure", () => {
    const script = fileURLToPath(new URL("../scripts/verify-phase13-credential-isolation.mjs", import.meta.url));
    const leakedSecret = "must-never-appear-in-output";
    let output = "";

    try {
      execFileSync(process.execPath, [script], {
        encoding: "utf8",
        env: {
          ...process.env,
          ...validEnv,
          PHASE13_DEV_JWT_SECRET: leakedSecret,
          PHASE13_PROD_JWT_SECRET: leakedSecret,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; status?: number };
      expect(failure.status).toBe(1);
      output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
    }

    expect(output).toBe("NO-GO\n");
    expect(output).not.toContain(leakedSecret);
    expect(output).not.toMatch(/[a-f0-9]{32,}/i);
  });
});
