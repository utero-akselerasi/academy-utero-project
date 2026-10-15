import { hashPassword, needsPasswordRehash, verifyPassword } from "../auth/password.mjs";
import { createSession, expiredSessionCookie, revokeSession, sessionCookie } from "../auth/session.mjs";
import { requireIdentity } from "../auth/identity.mjs";
import { issueVerificationToken, RESEND_INTERVAL_SECONDS, sendVerificationEmail, tokenDigest } from "../auth/email.mjs";
import { parseResendEmail, parseSignup, parseVerificationToken } from "../auth/signup.mjs";

const ACTIVE_ROLES = ["super_admin", "admin", "school", "intern", "applicant"];

export async function authRoutes(app, options) {
  const { db, config } = options;

  app.post("/v1/auth/signup", { config: { rateLimit: { max: 3, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const parsed = parseSignup(request.body);
    if (parsed.error) return reply.code(400).send({ error: parsed.error });
    const { fullName, email, password } = parsed.value;
    try {
      const user = await db.apiTransaction(async (client) => {
        const existing = await client.query(
          "select 1 from auth.users where lower(email) = $1 and deleted_at is null limit 1",
          [email],
        );
        if (existing.rows.length) return null;
        const created = await client.query(
          `insert into auth.users
             (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
           values ($1, $2, null, $3::jsonb, $4::jsonb)
           returning id, email`,
          [
            email,
            await hashPassword(password),
            JSON.stringify({ provider: "email", providers: ["email"] }),
            JSON.stringify({ full_name: fullName, source_app: "utero_academy_applicant" }),
          ],
        );
        const row = created.rows[0];
        await client.query(
          `insert into auth.identities
             (id, user_id, provider_id, identity_data, provider, last_sign_in_at)
           values ($1, $2, $1, $3::jsonb, 'email', null)`,
          [row.id, row.id, JSON.stringify({ sub: row.id, email, email_verified: false })],
        );
        const token = await issueVerificationToken(client, row.id);
        try {
          await sendVerificationEmail(config, email, token);
        } catch (error) {
          request.log.error({ err: error }, "verification delivery failed");
          throw Object.assign(new Error("verification delivery failed"), { code: "email_delivery_failed" });
        }
        return row;
      });
      if (!user) return reply.code(409).send({ error: "account_unavailable" });
      return reply.code(201).send({ ok: true, verificationSent: true, user: { id: user.id, email: user.email } });
    } catch (error) {
      if (error?.code === "23505") return reply.code(409).send({ error: "account_unavailable" });
      if (error?.code === "email_delivery_failed") return reply.code(503).send({ error: "verification_email_unavailable" });
      throw error;
    }
  });

  app.post("/v1/auth/verify-email", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const parsed = parseVerificationToken(request.body);
    if (parsed.error) return reply.code(400).send({ error: parsed.error });
    const verified = await db.apiTransaction(async (client) => {
      const result = await client.query(
        `select token.user_id from auth.email_verification_tokens token
         join auth.users users on users.id = token.user_id
         where token.token_hash = $1 and token.consumed_at is null and token.expires_at > now()
           and users.deleted_at is null and users.email_confirmed_at is null
         for update of token, users`,
        [tokenDigest(parsed.value)],
      );
      const row = result.rows[0];
      if (!row) return false;
      await client.query("update auth.email_verification_tokens set consumed_at = now() where token_hash = $1", [tokenDigest(parsed.value)]);
      await client.query("update auth.users set email_confirmed_at = now(), updated_at = now() where id = $1", [row.user_id]);
      await client.query(
        `update auth.identities set identity_data = jsonb_set(identity_data, '{email_verified}', 'true'::jsonb, true), updated_at = now()
         where user_id = $1 and provider = 'email'`,
        [row.user_id],
      );
      return true;
    });
    if (!verified) return reply.code(400).send({ error: "invalid_or_expired_token" });
    return { ok: true };
  });

  app.post("/v1/auth/accept-invitation", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const parsed = parseVerificationToken(request.body);
    const password = request.body?.password;
    if (parsed.error || typeof password !== "string" || password.length < 12 || password.length > 128) return reply.code(400).send({ error: "invalid_invitation" });
    const passwordHash = await hashPassword(password);
    const accepted = await db.apiTransaction(async (client) => {
      const token = (await client.query(`select t.user_id from auth.account_invitation_tokens t join auth.users u on u.id=t.user_id
        where t.token_hash=$1 and t.expires_at>now() and t.consumed_at is null and u.deleted_at is null and u.email_confirmed_at is null
        for update of t,u`, [tokenDigest(parsed.value)])).rows[0];
      if (!token) return false;
      await client.query("update auth.account_invitation_tokens set consumed_at=now() where token_hash=$1", [tokenDigest(parsed.value)]);
      await client.query("update auth.users set encrypted_password=$2,email_confirmed_at=now(),updated_at=now() where id=$1", [token.user_id, passwordHash]);
      await client.query("update auth.identities set identity_data=jsonb_set(identity_data,'{email_verified}','true'::jsonb,true),updated_at=now() where user_id=$1 and provider='email'", [token.user_id]);
      return true;
    });
    return accepted ? { ok: true } : reply.code(400).send({ error: "invalid_or_expired_token" });
  });

  app.post("/v1/auth/resend-verification", { config: { rateLimit: { max: 3, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const parsed = parseResendEmail(request.body);
    if (parsed.error) return reply.code(400).send({ error: parsed.error });
    const outcome = await db.apiTransaction(async (client) => {
      const result = await client.query(
        `select users.id, users.email,
           (select max(created_at) from auth.email_verification_tokens where user_id = users.id) last_sent_at
         from auth.users users where lower(users.email) = $1 and users.deleted_at is null and users.email_confirmed_at is null
         for update`,
        [parsed.value],
      );
      const user = result.rows[0];
      if (!user) return "noop";
      if (user.last_sent_at && Date.now() - new Date(user.last_sent_at).getTime() < RESEND_INTERVAL_SECONDS * 1000) return "limited";
      const token = await issueVerificationToken(client, user.id);
      try {
        await sendVerificationEmail(config, user.email, token);
      } catch (error) {
        request.log.error({ err: error }, "verification delivery failed");
        throw Object.assign(new Error("verification delivery failed"), { code: "email_delivery_failed" });
      }
      return "sent";
    }).catch((error) => {
      if (error?.code === "email_delivery_failed") return "delivery_failed";
      throw error;
    });
    if (outcome === "delivery_failed") return reply.code(503).send({ error: "verification_email_unavailable" });
    if (outcome === "limited") return { ok: true };
    return { ok: true };
  });

  app.post("/v1/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const email = String(request.body?.email || "").trim().toLowerCase();
    const password = String(request.body?.password || "");
    if (!email || password.length < 1) return reply.code(400).send({ error: "invalid_credentials" });
    const result = await db.query(
      "select id, encrypted_password from auth.users where lower(email) = $1 and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until < now())",
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.encrypted_password || ""))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const assigned = await db.query(
      `select roles.code from utero_academy.user_roles assignments
       join utero_academy.roles roles on roles.id = assignments.role_id
       where assignments.user_id = $1 and roles.is_assignable and roles.code = any($2::text[])`,
      [user.id, ACTIVE_ROLES],
    );
    if (!assigned.rows.length) return reply.code(403).send({ error: "role_missing" });
    if (needsPasswordRehash(user.encrypted_password)) {
      await db.query("update auth.users set encrypted_password = $2, updated_at = now() where id = $1", [user.id, await hashPassword(password)]);
    }
    const token = await createSession(db, user.id, config.sessionTtlSeconds, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    reply.header("set-cookie", sessionCookie(config.sessionCookie, token, config.sessionTtlSeconds, config.secureCookies));
    return { ok: true, user: { id: user.id, email, roles: assigned.rows.map(({ code }) => code) } };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    await revokeSession(db, request.identity?.token);
    reply.header("set-cookie", expiredSessionCookie(config.sessionCookie, config.secureCookies));
    return { ok: true };
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    return { user: { id: identity.id, email: identity.email, fullName: identity.full_name, roles: identity.roles, permissions: identity.permissions } };
  });

  app.get("/v1/users/:id/roles", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    if (request.params.id !== identity.id && !identity.roles.includes("super_admin") && !identity.permissions.includes("users.manage")) {
      return reply.code(403).send({ error: "forbidden" });
    }
    if (!/^[a-f0-9-]{36}$/i.test(request.params.id)) return reply.code(400).send({ error: "invalid_user_id" });
    const assigned = await db.query(
      `select distinct roles.code from utero_academy.user_roles assignments
       join utero_academy.roles roles on roles.id = assignments.role_id
       where assignments.user_id = $1 and roles.is_assignable and roles.code = any($2::text[])`,
      [request.params.id, ACTIVE_ROLES],
    );
    return { roles: assigned.rows.map(({ code }) => code) };
  });

  app.post("/v1/auth/change-password", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const currentPassword = String(request.body?.currentPassword || "");
    const newPassword = String(request.body?.newPassword || "");
    if (newPassword.length < 12) return reply.code(400).send({ error: "password_too_short" });
    const result = await db.query("select encrypted_password from auth.users where id = $1", [identity.id]);
    if (!result.rows[0] || !(await verifyPassword(currentPassword, result.rows[0].encrypted_password || ""))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    await db.transaction(identity, async (client) => {
      await client.query("update auth.users set encrypted_password = $2, updated_at = now() where id = $1", [identity.id, await hashPassword(newPassword)]);
      await client.query("update auth.sessions set revoked_at = now() where user_id = $1 and revoked_at is null", [identity.id]);
    });
    const token = await createSession(db, identity.id, config.sessionTtlSeconds, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    reply.header("set-cookie", sessionCookie(config.sessionCookie, token, config.sessionTtlSeconds, config.secureCookies));
    return { ok: true };
  });

  app.get("/v1/auth/intern-activation", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    if (!identity.roles.includes("intern")) return reply.code(403).send({ error: "forbidden" });
    return db.transaction(identity, async (client) => {
      const profile = (await client.query(`select i.id,i.full_name,i.email,i.phone,i.major,i.grade_or_semester,i.school_name,i.address,i.school_supervisor_name,i.school_supervisor_phone,i.emergency_contact_name,i.emergency_contact_phone,i.start_date,i.end_date,i.status,p.full_name as user_full_name
        from utero_academy.intern_profiles i left join utero_academy.user_profiles p on p.id=i.user_id where i.user_id=$1`, [identity.id])).rows[0];
      const application = (await client.query(`select id,status,onboarding_status,converted_intern_id,approved_start_date,approved_end_date
        from utero_academy.internship_applications where applicant_user_id=$1 and converted_intern_id is not null order by converted_at desc limit 1`, [identity.id])).rows[0] ?? null;
      return { profile: profile ?? null, application };
    });
  });

  app.post("/v1/auth/intern-activation", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    if (!identity.roles.includes("intern")) return reply.code(403).send({ error: "forbidden" });
    try {
      return await db.transaction(identity, async (client) => {
        const result = await client.query("select utero_academy.activate_current_intern() as id");
        return { id: result.rows[0].id };
      });
    } catch (error) {
      if (error?.code === "42501" || error?.code === "P0001") return reply.code(403).send({ error: "intern_inactive" });
      throw error;
    }
  });
}
