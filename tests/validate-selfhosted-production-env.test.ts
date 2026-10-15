import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  parseCliArgs,
  parseEnvFile,
  validateComposeCookieOverrides,
  validateSelfhostedProductionEnv,
} from "../scripts/validate-selfhosted-production-env.mjs";

const compose = `services:
  web:
    environment:
      ACADEMY_SECURE_COOKIES: "true"
  api:
    environment:
      SECURE_COOKIES: "true"`;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "academy-production-env-"));
  const tls = join(root, "tls");
  const storage = join(root, "storage-export");
  mkdirSync(tls);
  mkdirSync(storage);
  writeFileSync(join(tls, "fullchain.pem"), "certificate");
  writeFileSync(join(tls, "privkey.pem"), "private-key");
  const env = {
    ACADEMY_POSTGRES_PASSWORD: "prod-postgres-2Yx!9mQ#7Vk",
    ACADEMY_API_PASSWORD: "prod-api-W8q!4Ns#6Jt",
    ACADEMY_STORAGE_SIGNING_SECRET: "storage-signing-F7p!3Dz#8Kr@5LmQ",
    ACADEMY_MIGRATION_DATABASE_URL: "postgresql://postgres:prod-postgres-2Yx!9mQ%237Vk@postgres:5432/academy",
    ACADEMY_API_DATABASE_URL: "postgresql://academy_api:prod-api-W8q!4Ns%236Jt@postgres:5432/academy",
    NEXT_PUBLIC_APP_URL: "https://academy.utero.id",
    PUBLIC_APP_URL: "https://academy.utero.id",
    ACADEMY_SECURE_COOKIES: "true",
    SMTP_HOST: "smtp.utero.id",
    SMTP_PORT: "587",
    SMTP_USER: "academy@utero.id",
    SMTP_PASSWORD: "smtp-prod-B5n!8Fx#4Qa",
    SMTP_FROM: "Utero Academy <academy@utero.id>",
    ACADEMY_TLS_CERT_DIR: tls,
    SOURCE_DATABASE_URL: "postgresql://reader:source-secret@source-db:5432/postgres",
    STORAGE_IMPORT_SOURCE: storage,
  };
  return { root, env };
}

describe("validate self-hosted production environment", () => {
  it("menerima environment production lengkap tanpa mengembalikan secret", async () => {
    const { root, env } = fixture();
    try {
      const result = await validateSelfhostedProductionEnv(env, { composeText: compose });
      expect(result.ready).toBe(true);
      expect(JSON.stringify(result)).not.toContain(env.ACADEMY_POSTGRES_PASSWORD);
      expect(result.checks).toContain("tls-files");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("menerima predeploy tanpa source database dan storage import", async () => {
    const { root, env } = fixture();
    try {
      env.SOURCE_DATABASE_URL = "";
      env.STORAGE_IMPORT_SOURCE = "";
      await expect(validateSelfhostedProductionEnv(env, { composeText: compose })).resolves.toMatchObject({ ready: true });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("menolak URL nonkanonis, origin berbeda, dan cookie tidak aman", async () => {
    const { root, env } = fixture();
    try {
      await expect(validateSelfhostedProductionEnv({ ...env, PUBLIC_APP_URL: "http://academy.utero.id" }, { composeText: compose })).rejects.toThrow("HTTPS kanonis");
      await expect(validateSelfhostedProductionEnv({ ...env, NEXT_PUBLIC_APP_URL: "https://other.utero.id" }, { composeText: compose })).rejects.toThrow("origin yang sama");
      await expect(validateSelfhostedProductionEnv({ ...env, ACADEMY_SECURE_COOKIES: "false" }, { composeText: compose })).rejects.toThrow("wajib true");
      expect(() => validateComposeCookieOverrides(compose.replace('SECURE_COOKIES: "true"', "SECURE_COOKIES: ${SECURE_COOKIES}"))).toThrow("memaksa secure cookies");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("menolak source dan target PostgreSQL yang sama", async () => {
    const { root, env } = fixture();
    try {
      const unsafe = { ...env, SOURCE_DATABASE_URL: "postgresql://reader:secret@postgres:5432/academy" };
      await expect(validateSelfhostedProductionEnv(unsafe, { composeText: compose })).rejects.toThrow("sumber dan target");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("menolak placeholder, SMTP invalid, signing secret pendek, dan TLS hilang", async () => {
    const { root, env } = fixture();
    try {
      await expect(validateSelfhostedProductionEnv({ ...env, SMTP_PASSWORD: "CHANGE_ME" }, { composeText: compose })).rejects.toThrow("Placeholder");
      await expect(validateSelfhostedProductionEnv({ ...env, SMTP_PORT: "70000" }, { composeText: compose })).rejects.toThrow("SMTP_PORT");
      await expect(validateSelfhostedProductionEnv({ ...env, ACADEMY_STORAGE_SIGNING_SECRET: "short" }, { composeText: compose })).rejects.toThrow("32 byte");
      await expect(validateSelfhostedProductionEnv({ ...env, ACADEMY_TLS_CERT_DIR: join(root, "missing") }, { composeText: compose })).rejects.toThrow("File TLS tidak ditemukan");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("memvalidasi optional storage source hanya ketika terisi", async () => {
    const { root, env } = fixture();
    try {
      await expect(validateSelfhostedProductionEnv({ ...env, STORAGE_IMPORT_SOURCE: "relative/export" }, { composeText: compose })).rejects.toThrow("path absolut");
      await expect(validateSelfhostedProductionEnv({ ...env, STORAGE_IMPORT_SOURCE: join(root, "missing") }, { composeText: compose })).rejects.toThrow("tidak ditemukan");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("parser menolak duplikat dan CLI mewajibkan --env-file absolut", () => {
    expect(parseEnvFile("SMTP_PORT=587 # submission\nSMTP_HOST='smtp.utero.id'")).toEqual({ SMTP_PORT: "587", SMTP_HOST: "smtp.utero.id" });
    expect(() => parseEnvFile("A=one\nA=two")).toThrow("duplikat");
    expect(() => parseCliArgs(["--env-file", "relative.env"])).toThrow("path-absolut");
    expect(parseCliArgs(["--env-file", resolve("production.env")])).toHaveProperty("envFile");
  });

  it("CLI gagal tertutup tanpa mencetak nilai secret", () => {
    const directory = mkdtempSync(join(tmpdir(), "academy-production-cli-"));
    try {
      const envFile = join(directory, "production.env");
      const secret = "must-never-appear-in-output";
      writeFileSync(envFile, `ACADEMY_POSTGRES_PASSWORD=${secret}\n`);
      const script = join(import.meta.dirname, "..", "scripts", "validate-selfhosted-production-env.mjs");
      const result = spawnSync(process.execPath, [script, "--env-file", envFile], { encoding: "utf8", timeout: 10000 });
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stderr)).toMatchObject({ ready: false });
      expect(result.stdout + result.stderr).not.toContain(secret);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
