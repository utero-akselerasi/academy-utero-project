import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildProductionReadinessSummary,
  parseProductionReadinessArgs,
} from "../scripts/production-readiness-summary.mjs";

async function envFixture(secret = "secret-that-must-not-be-printed") {
  const root = await mkdtemp(path.join(tmpdir(), "academy-readiness-summary-"));
  const envFile = path.join(root, "production.env");
  const env = {
    ACADEMY_POSTGRES_PASSWORD: "postgres-prod-F4!u8Q#2",
    ACADEMY_API_PASSWORD: "api-prod-N7!x3T#9",
    ACADEMY_STORAGE_SIGNING_SECRET: "storage-signing-R8!z5K#3pL9mV2qW",
    ACADEMY_MIGRATION_DATABASE_URL: "postgresql://postgres:postgres-prod-F4!u8Q%232@postgres:5432/academy",
    ACADEMY_API_DATABASE_URL: "postgresql://academy_api:api-prod-N7!x3T%239@postgres:5432/academy",
    NEXT_PUBLIC_APP_URL: "https://academy.utero.id",
    PUBLIC_APP_URL: "https://academy.utero.id",
    ACADEMY_SECURE_COOKIES: "true",
    SMTP_HOST: "smtp.utero.id",
    SMTP_PORT: "587",
    SMTP_USER: "academy@utero.id",
    SMTP_PASSWORD: "smtp-prod-B6!r2P#8",
    SMTP_FROM: "Utero Academy <academy@utero.id>",
  };
  await writeFile(envFile, Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n"));
  return { root, envFile, secret };
}

describe("production readiness summary", () => {
  it("menghasilkan PASS hanya saat env dan evaluator existing lulus", async () => {
    const fixture = await envFixture();
    const checklist = path.join(fixture.root, "checklist.json");
    await writeFile(checklist, "{}");
    const report = await buildProductionReadinessSummary({ envFile: fixture.envFile, checklist }, {
      evaluateGate: async (value: string) => {
        expect(value).toBe(checklist);
        return { decision: "GO", evidenceCount: 11 };
      },
      validateEnv: async (env: Record<string, string>) => {
        expect(env.ACADEMY_POSTGRES_PASSWORD).toBeTruthy();
        return { ready: true, checks: ["required-values", "no-placeholders-or-fixtures"] };
      },
    });
    expect(report.status).toBe("PASS");
    expect(report.checks.environment).toMatchObject({ status: "PASS", validation: "full" });
    expect(report.checks.evidence).toMatchObject({ status: "PASS", decision: "GO", evidenceCount: 11 });
    expect(Object.keys(report.checks)).toEqual(["environment", "evidence"]);
    expect(JSON.stringify(report)).not.toContain(fixture.secret);
  });

  it("fail closed saat input belum diberikan", async () => {
    const report = await buildProductionReadinessSummary({});
    expect(report.status).toBe("NO-GO");
    expect(Object.values(report.checks).every((check) => check.status === "FAIL")).toBe(true);
  });

  it("menjalankan validator penuh dan tidak mencetak nilai env", async () => {
    const fixture = await envFixture("private-value");
    const report = await buildProductionReadinessSummary({ envFile: fixture.envFile }, {
      validateEnv: async () => { throw new Error("Placeholder atau fixture ditolak: SMTP_PASSWORD"); },
    });
    expect(report.status).toBe("NO-GO");
    expect(report.checks.environment).toEqual({ status: "FAIL", error: "Placeholder atau fixture ditolak: SMTP_PASSWORD" });
    expect(JSON.stringify(report)).not.toContain("private-value");
  });

  it("menolak placeholder melalui validator production existing", async () => {
    const fixture = await envFixture();
    const content = await readFile(fixture.envFile, "utf8");
    await writeFile(fixture.envFile, content.replace(/SMTP_PASSWORD=.*/, "SMTP_PASSWORD=CHANGE_ME"));
    const report = await buildProductionReadinessSummary({ envFile: fixture.envFile });
    expect(report.status).toBe("NO-GO");
    expect(report.checks.environment).toMatchObject({ status: "FAIL" });
    expect(JSON.stringify(report)).not.toContain("CHANGE_ME");
  });

  it("tidak mengganti keputusan evaluator existing", async () => {
    const fixture = await envFixture();
    const checklist = path.join(fixture.root, "checklist.json");
    await writeFile(checklist, "{}");
    const report = await buildProductionReadinessSummary({ envFile: fixture.envFile, checklist }, {
      evaluateGate: async () => { throw new Error("Evidence writeFreeze tidak lengkap"); },
    });
    expect(report.status).toBe("NO-GO");
    expect(report.checks.evidence).toEqual({ status: "FAIL", error: "Evidence writeFreeze tidak lengkap" });
  });

  it("parser hanya menerima flag dikenal dengan path absolut", () => {
    const absolute = path.resolve("production.env");
    expect(parseProductionReadinessArgs(["--env-file", absolute])).toEqual({ envFile: absolute,
      checklist: undefined });
    expect(() => parseProductionReadinessArgs(["--env-file", "relative.env"])).toThrow("read-only");
    expect(() => parseProductionReadinessArgs(["--disk-path", absolute])).toThrow("read-only");
  });
});
