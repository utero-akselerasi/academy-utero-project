#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import nodemailer from "nodemailer";
import { parseEnvFile } from "./validate-selfhosted-production-env.mjs";

const CONFIRMATION = "send-production-smoke-email";
const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const PLACEHOLDER = /(?:change[-_ ]?me|replace[-_ ]?me|local-full-test|fixture|example\.(?:com|net|org|test)|\.example(?:[/:]|$)|password-kuat-123|<[A-Za-z][A-Za-z0-9_-]*>|\$\{[^}]+\})/i;
const usage = `Kirim satu email smoke production dan tulis evidence yang berlaku 24 jam.
  node scripts/selfhosted-smtp-smoke.mjs --env-file <path-absolut> --to <alamat-khusus> \\
    --output <path-absolut> --confirm send-production-smoke-email

Perintah ini benar-benar mengirim email. Hanya SMTP port 465 (SMTPS) atau 587 (STARTTLS) yang diterima.`;

function fail(message) {
  throw new Error(message);
}

function emailAddress(value, label) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || /[\r\n]/.test(normalized) || !EMAIL_PATTERN.test(normalized)) {
    fail(`${label} tidak valid`);
  }
  return normalized;
}

function fromAddress(value) {
  const trimmed = value?.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) fail("SMTP_FROM tidak valid");
  const bracketed = /<([^<>]+)>$/.exec(trimmed);
  return emailAddress(bracketed?.[1] ?? trimmed, "SMTP_FROM");
}

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) fail(`Variabel SMTP wajib kosong: ${key}`);
  if (PLACEHOLDER.test(value)) fail(`Nilai production tidak valid: ${key}`);
  return value;
}

function optionMap(args) {
  if (args.length !== 8 || args.some((item, index) => index % 2 === 0 && !item.startsWith("--"))) fail(usage);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!new Set(["--env-file", "--to", "--output", "--confirm"]).has(key) || Object.hasOwn(values, key)) fail(usage);
    values[key] = args[index + 1];
  }
  return values;
}

export function parseSmtpSmokeArgs(args) {
  const values = optionMap(args);
  if (!path.isAbsolute(values["--env-file"] ?? "") || !path.isAbsolute(values["--output"] ?? "")) fail(usage);
  if (path.resolve(values["--env-file"]) === path.resolve(values["--output"])) fail("--env-file dan --output wajib berbeda");
  if (values["--confirm"] !== CONFIRMATION) fail(`Konfirmasi wajib tepat: ${CONFIRMATION}`);
  return { envFile: values["--env-file"], to: emailAddress(values["--to"], "--to"), output: values["--output"] };
}

export function smtpTransportConfig(env, recipient) {
  const host = required(env, "SMTP_HOST").toLowerCase();
  if (host === "localhost" || isIP(host) !== 0 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/.test(host)) {
    fail("SMTP_HOST wajib hostname DNS production");
  }
  const port = Number(required(env, "SMTP_PORT"));
  if (![465, 587].includes(port)) fail("SMTP_PORT production wajib 465 atau 587");
  const user = required(env, "SMTP_USER");
  const pass = required(env, "SMTP_PASSWORD");
  const from = required(env, "SMTP_FROM");
  const sender = fromAddress(from);
  if (sender === recipient) fail("--to wajib mailbox smoke khusus yang berbeda dari SMTP_FROM");
  const secure = port === 465;
  return {
    from,
    sender,
    transport: {
      host, port, secure, requireTLS: !secure, auth: { user, pass },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true, servername: host },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    },
  };
}

function acceptedAddress(value) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (value && typeof value === "object" && typeof value.address === "string") return value.address.trim().toLowerCase();
  return "";
}

export async function runSmtpSmoke({ env, to }, dependencies = {}) {
  const now = dependencies.now ?? (() => new Date());
  const makeTransport = dependencies.createTransport ?? ((options) => nodemailer.createTransport(options));
  const makeId = dependencies.randomUUID ?? randomUUID;
  const startedAt = now();
  let smtp = { host: null, port: null, tlsMode: null };
  let stage = "configuration";
  let subject = null;
  let messageIdSha256 = null;
  const checks = {
    configuration: { ok: false },
    tlsAndAuthentication: { ok: false },
    delivery: { ok: false },
  };

  try {
    const config = smtpTransportConfig(env, to);
    smtp = { host: config.transport.host, port: config.transport.port,
      tlsMode: config.transport.secure ? "implicit-tls" : "starttls-required" };
    checks.configuration = { ok: true };
    const transport = makeTransport(config.transport);
    stage = "tlsAndAuthentication";
    if (await transport.verify() !== true) fail("SMTP verify tidak mengembalikan true");
    checks.tlsAndAuthentication = { ok: true };
    stage = "delivery";
    subject = `[Academy Production SMTP Smoke] ${startedAt.toISOString()} ${makeId()}`;
    const result = await transport.sendMail({
      from: config.from,
      to,
      subject,
      text: "Academy production SMTP smoke test. Pesan ini membuktikan jalur TLS, autentikasi, dan penerimaan SMTP.",
      headers: { "X-Academy-Smoke-Test": "production" },
    });
    const accepted = Array.isArray(result?.accepted) ? result.accepted.map(acceptedAddress).filter(Boolean) : [];
    const rejected = Array.isArray(result?.rejected) ? result.rejected.map(acceptedAddress).filter(Boolean) : [];
    if (!accepted.includes(to) || rejected.length > 0) fail("Penerimaan SMTP tidak terkonfirmasi");
    if (typeof result?.messageId === "string" && result.messageId) {
      messageIdSha256 = createHash("sha256").update(result.messageId).digest("hex");
    }
    checks.delivery = { ok: true, recipientAccepted: true, messageIdSha256 };
  } catch {
    checks[stage] = { ok: false, code: stage === "configuration" ? "SMTP_CONFIGURATION_INVALID" :
      stage === "tlsAndAuthentication" ? "SMTP_TLS_OR_AUTH_FAILED" : "SMTP_DELIVERY_FAILED" };
  }

  const finishedAt = now();
  const status = Object.values(checks).every((check) => check.ok) ? "PASS" : "FAIL";
  return {
    schemaVersion: 1,
    gate: "smtpSmoke",
    target: "production",
    mode: "explicit-production-email-send",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    expiresAt: new Date(finishedAt.getTime() + MAX_EVIDENCE_AGE_MS).toISOString(),
    status,
    recipient: to,
    subject,
    smtp,
    checks,
  };
}

export async function writeSmtpSmokeEvidence(report, output) {
  const content = `${JSON.stringify(report, null, 2)}\n`;
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600, flag: "wx" });
  await rename(temporary, output);
  return { path: output, sizeBytes: Buffer.byteLength(content),
    sha256: createHash("sha256").update(content).digest("hex") };
}

async function main() {
  let output;
  try {
    const options = parseSmtpSmokeArgs(process.argv.slice(2));
    output = options.output;
    const metadata = await lstat(options.envFile);
    if (!metadata.isFile() || metadata.isSymbolicLink()) fail("--env-file wajib berkas reguler, bukan symlink");
    const env = parseEnvFile(await readFile(options.envFile, "utf8"));
    const report = await runSmtpSmoke({ env, to: options.to });
    const evidence = await writeSmtpSmokeEvidence(report, output);
    process.stdout.write(`${JSON.stringify({ status: report.status, evidence })}\n`);
    if (report.status !== "PASS") process.exitCode = 1;
  } catch {
    process.stderr.write(JSON.stringify({ status: "FAIL", error: "SMTP smoke gagal sebelum evidence lengkap ditulis", output: output ?? null }) + "\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
