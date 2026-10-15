import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

export const TOKEN_TTL_SECONDS = 60 * 60;
export const RESEND_INTERVAL_SECONDS = 60;

export function smtpTransportOptions(smtp) {
  if (smtp.port !== 465 && smtp.port !== 587) throw new Error("SMTP requires port 465 or 587");
  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    requireTLS: smtp.port === 587,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
  };
}

export function tokenDigest(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueVerificationToken(client, userId) {
  const token = randomBytes(32).toString("hex");
  await client.query("delete from auth.email_verification_tokens where user_id = $1", [userId]);
  await client.query(
    "insert into auth.email_verification_tokens (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 * interval '1 second'))",
    [tokenDigest(token), userId, TOKEN_TTL_SECONDS],
  );
  return token;
}

export async function sendVerificationEmail(config, email, token) {
  if (!config.smtp?.host || !config.smtp?.from || !config.publicAppUrl) throw new Error("SMTP verification configuration missing");
  if (/[\r\n,;<>]/.test(email)) throw new Error("Unsafe recipient address");
  const transport = nodemailer.createTransport(smtpTransportOptions(config.smtp));
  try {
    const url = new URL("/register/verify", config.publicAppUrl);
    url.searchParams.set("token", token);
    await transport.sendMail({
      from: config.smtp.from,
      to: email,
      subject: "Verifikasi email akun Utero Academy",
      text: `Buka tautan ini untuk verifikasi email (berlaku 1 jam): ${url.toString()}\nJika tidak mendaftar, abaikan pesan ini.`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  } finally {
    transport.close();
  }
}

export async function sendInvitationEmail(config, email, token) {
  if (!config.smtp?.host || !config.smtp?.from || !config.publicAppUrl) throw new Error("SMTP invitation configuration missing");
  if (/[\r\n,;<>]/.test(email)) throw new Error("Unsafe recipient address");
  const transport = nodemailer.createTransport(smtpTransportOptions(config.smtp));
  try {
    const url = new URL("/register/invite", config.publicAppUrl);
    url.searchParams.set("token", token);
    await transport.sendMail({ from: config.smtp.from, to: email, subject: "Undangan Utero Academy", text: `Atur password melalui tautan ini (berlaku 1 jam): ${url.toString()}\nJika tidak mengenali undangan ini, abaikan pesan.`, disableFileAccess: true, disableUrlAccess: true });
  } finally {
    transport.close();
  }
}
