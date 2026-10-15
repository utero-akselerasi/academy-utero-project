import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseSmtpSmokeArgs, runSmtpSmoke, smtpTransportConfig,
  writeSmtpSmokeEvidence } from "../scripts/selfhosted-smtp-smoke.mjs";

const env = {
  SMTP_HOST: "smtp.mail.academy.id",
  SMTP_PORT: "587",
  SMTP_USER: "academy-production",
  SMTP_PASSWORD: "top-secret-smtp-password",
  SMTP_FROM: "Academy <no-reply@academy.id>",
};
const recipient = "production-smoke@academy.id";

function dependencies(overrides: Record<string, unknown> = {}) {
  const dates = [new Date("2026-10-15T10:00:00.000Z"), new Date("2026-10-15T10:00:01.000Z")];
  const verify = vi.fn(async () => true);
  const sendMail = vi.fn(async () => ({ accepted: [recipient], rejected: [], messageId: "provider-message-id" }));
  const createTransport = vi.fn(() => ({ verify, sendMail }));
  return {
    now: () => dates.shift() ?? new Date("2026-10-15T10:00:01.000Z"),
    randomUUID: () => "12345678-1234-4234-8234-123456789abc",
    createTransport,
    verify,
    sendMail,
    ...overrides,
  };
}

describe("self-hosted SMTP production smoke", () => {
  it("mewajibkan path absolut, recipient khusus, dan konfirmasi persis", () => {
    const envFile = path.join(tmpdir(), "academy-production.env");
    const output = path.join(tmpdir(), "smtp-smoke.json");
    expect(parseSmtpSmokeArgs(["--env-file", envFile, "--to", recipient, "--output", output,
      "--confirm", "send-production-smoke-email"])).toEqual({ envFile, to: recipient, output });
    expect(() => parseSmtpSmokeArgs(["--env-file", "relative.env", "--to", recipient, "--output", output,
      "--confirm", "send-production-smoke-email"])).toThrow();
    expect(() => parseSmtpSmokeArgs(["--env-file", envFile, "--to", recipient, "--output", output,
      "--confirm", "yes"])).toThrow("Konfirmasi wajib tepat");
    expect(() => parseSmtpSmokeArgs(["--env-file", envFile, "--to", "bad\n@example.com", "--output", output,
      "--confirm", "send-production-smoke-email"])).toThrow();
  });

  it("mengunci TLS, validasi sertifikat, dan auth tanpa mengubah secret", () => {
    const config = smtpTransportConfig(env, recipient);
    expect(config.transport).toMatchObject({ host: env.SMTP_HOST, port: 587, secure: false, requireTLS: true,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true, servername: env.SMTP_HOST } });
    expect(() => smtpTransportConfig({ ...env, SMTP_PORT: "25" }, recipient)).toThrow("465 atau 587");
    expect(() => smtpTransportConfig({ ...env, SMTP_HOST: "127.0.0.1" }, recipient)).toThrow("hostname DNS production");
    expect(() => smtpTransportConfig(env, "no-reply@academy.id")).toThrow("mailbox smoke khusus");
  });

  it("mengirim subject unik dan menghasilkan evidence PASS 24 jam", async () => {
    const deps = dependencies();
    const report = await runSmtpSmoke({ env, to: recipient }, deps);
    expect(report).toMatchObject({ gate: "smtpSmoke", target: "production", status: "PASS", recipient,
      startedAt: "2026-10-15T10:00:00.000Z", finishedAt: "2026-10-15T10:00:01.000Z",
      expiresAt: "2026-10-16T10:00:01.000Z" });
    expect(deps.verify).toHaveBeenCalledOnce();
    expect(deps.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: recipient,
      subject: "[Academy Production SMTP Smoke] 2026-10-15T10:00:00.000Z 12345678-1234-4234-8234-123456789abc",
    }));
    expect(JSON.stringify(report)).not.toContain(env.SMTP_PASSWORD);
    expect(JSON.stringify(report)).not.toContain(env.SMTP_USER);
    expect(report.checks.delivery.messageIdSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fail closed saat TLS/auth gagal dan tidak mencoba kirim", async () => {
    const deps = dependencies({ createTransport: () => ({
      verify: vi.fn(async () => { throw new Error(`auth failed ${env.SMTP_PASSWORD}`); }),
      sendMail: vi.fn(async () => { throw new Error("tidak boleh dipanggil"); }),
    }) });
    const report = await runSmtpSmoke({ env, to: recipient }, deps);
    expect(report.status).toBe("FAIL");
    expect(report.checks.tlsAndAuthentication).toEqual({ ok: false, code: "SMTP_TLS_OR_AUTH_FAILED" });
    expect(JSON.stringify(report)).not.toContain(env.SMTP_PASSWORD);
  });

  it("fail closed jika provider tidak mengakui recipient", async () => {
    const deps = dependencies({ createTransport: () => ({
      verify: vi.fn(async () => true),
      sendMail: vi.fn(async () => ({ accepted: [], rejected: [recipient], messageId: "rejected" })),
    }) });
    const report = await runSmtpSmoke({ env, to: recipient }, deps);
    expect(report.status).toBe("FAIL");
    expect(report.checks.delivery).toEqual({ ok: false, code: "SMTP_DELIVERY_FAILED" });
  });

  it("menulis evidence atomik dengan hash yang cocok", async () => {
    const output = path.join(tmpdir(), `academy-smtp-smoke-${process.pid}-${Date.now()}.json`);
    const report = await runSmtpSmoke({ env, to: recipient }, dependencies());
    const evidence = await writeSmtpSmokeEvidence(report, output);
    const content = await readFile(output);
    expect(evidence).toMatchObject({ path: output, sizeBytes: content.length });
    expect(evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(content.toString("utf8"))).toEqual(report);
  });
});
