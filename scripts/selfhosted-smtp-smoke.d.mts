import type SMTPTransport from "nodemailer/lib/smtp-transport";

export interface SmtpSmokeTransport {
  verify(): Promise<boolean>;
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    headers: Record<string, string>;
  }): Promise<{
    accepted?: Array<string | { address: string }>;
    rejected?: Array<string | { address: string }>;
    messageId?: string;
  }>;
}

export interface SmtpSmokeOptions {
  envFile: string;
  to: string;
  output: string;
}

export interface SmtpSmokeReport {
  schemaVersion: 1;
  gate: "smtpSmoke";
  target: "production";
  mode: "explicit-production-email-send";
  startedAt: string;
  finishedAt: string;
  expiresAt: string;
  status: "PASS" | "FAIL";
  recipient: string;
  subject: string | null;
  smtp: { host: string | null; port: number | null; tlsMode: "implicit-tls" | "starttls-required" | null };
  checks: Record<string, { ok: boolean; [key: string]: unknown }>;
}

export function parseSmtpSmokeArgs(args: string[]): SmtpSmokeOptions;
export function smtpTransportConfig(env: Record<string, string>, recipient: string): {
  from: string;
  sender: string;
  transport: SMTPTransport.Options;
};
export function runSmtpSmoke(input: { env: Record<string, string>; to: string }, dependencies?: {
  now?: () => Date;
  randomUUID?: () => string;
  createTransport?: (options: SMTPTransport.Options) => SmtpSmokeTransport;
}): Promise<SmtpSmokeReport>;
export function writeSmtpSmokeEvidence(report: SmtpSmokeReport, output: string): Promise<{
  path: string;
  sizeBytes: number;
  sha256: string;
}>;
