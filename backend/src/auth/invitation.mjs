import { randomBytes } from "node:crypto";
import { sendInvitationEmail, tokenDigest } from "./email.mjs";
import { parseResendEmail } from "./signup.mjs";

export async function inviteAccount(db, config, log, { email, fullName, role, applicationId, schoolId }) {
  const parsed = parseResendEmail({ email });
  if (parsed.error || typeof fullName !== "string" || fullName.trim().length < 3 || fullName.length > 150 || !["school", "applicant"].includes(role)) return { status: 400, error: "invalid_invitation" };
  const normalized = parsed.value;
  try {
    return await db.apiTransaction(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [normalized]);
      let user = (await client.query("select id,email,email_confirmed_at from auth.users where lower(email)=$1 and deleted_at is null for update", [normalized])).rows[0];
      if (user) {
        const roles = (await client.query("select r.code from utero_academy.user_roles ur join utero_academy.roles r on r.id=ur.role_id where ur.user_id=$1", [user.id])).rows.map((row) => row.code);
        if (roles.some((code) => code !== role) || (user.email_confirmed_at && role !== "applicant")) return { status: 409, error: "account_unavailable" };
      } else {
        user = (await client.query(`insert into auth.users(email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
          values($1,$2,$3::jsonb,$4::jsonb) returning id,email`, [normalized, "!invited", JSON.stringify({ provider: "email", providers: ["email"] }), JSON.stringify({ full_name: fullName.trim() })])).rows[0];
        await client.query("insert into auth.identities(id,user_id,provider_id,identity_data,provider) values($1,$2,$1,$3::jsonb,'email')", [user.id, user.id, JSON.stringify({ sub: user.id, email: normalized, email_verified: false })]);
      }
      await client.query("insert into utero_academy.user_profiles(id,full_name) values($1,$2) on conflict(id) do nothing", [user.id, fullName.trim()]);
      await client.query(`insert into utero_academy.user_roles(user_id,role_id)
        select $1,id from utero_academy.roles where code=$2 and is_assignable
        on conflict (user_id,role_id) where scope_type is null and scope_id is null do nothing`, [user.id, role]);
      if (role === "applicant") {
        const linked = await client.query("select utero_academy.link_invited_applicant($1,$2,$3) as linked", [applicationId, user.id, normalized]);
        if (!linked.rows[0]?.linked) throw Object.assign(new Error("application unavailable"), { code: "application_unavailable" });
      } else {
        const contacts = await client.query("update utero_academy.school_contacts set user_id=$2 where school_id=$1 and lower(email)=$3 and (user_id is null or user_id=$2) returning id", [schoolId, user.id, normalized]);
        if (!contacts.rowCount) throw Object.assign(new Error("contact unavailable"), { code: "contact_unavailable" });
      }
      if (user.email_confirmed_at) return { status: 200, ok: true, linked: true };
      const token = randomBytes(32).toString("hex");
      await client.query("delete from auth.account_invitation_tokens where user_id=$1", [user.id]);
      await client.query("insert into auth.account_invitation_tokens(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')", [tokenDigest(token), user.id]);
      try { await sendInvitationEmail(config, normalized, token); }
      catch (error) { log?.error({ err: error }, "invitation delivery failed"); throw Object.assign(new Error("invitation delivery failed"), { code: "email_delivery_failed" }); }
      return { status: 201, ok: true };
    });
  } catch (error) {
    if (error.code === "email_delivery_failed") return { status: 503, error: "invitation_email_unavailable" };
    if (error.code === "application_unavailable" || error.code === "contact_unavailable") return { status: 409, error: error.code };
    throw error;
  }
}
