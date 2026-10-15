import { randomBytes } from "node:crypto";
import { sendInvitationEmail, tokenDigest } from "./email.mjs";

export async function inviteImportedUser(db, config, userId, sendEmail = sendInvitationEmail) {
  try {
    return await db.apiTransaction(async (client) => {
      const user = (await client.query(
        `select id,email from auth.users
         where id=$1 and deleted_at is null and email_confirmed_at is null and encrypted_password is null
         for update`, [userId],
      )).rows[0];
      if (!user) return { status: 404, error: "pending_user_not_found" };
      const roles = await client.query(`select 1 from utero_academy.user_roles assignments
        join utero_academy.roles roles on roles.id=assignments.role_id
        where assignments.user_id=$1 and roles.is_assignable
          and roles.code=any($2::text[]) limit 1`, [userId, ["super_admin", "admin", "school", "intern", "applicant"]]);
      if (!roles.rowCount) return { status: 409, error: "role_required" };
      const token = randomBytes(32).toString("hex");
      await client.query("delete from auth.account_invitation_tokens where user_id=$1", [userId]);
      await client.query("insert into auth.account_invitation_tokens(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')", [tokenDigest(token), userId]);
      await sendEmail(config, user.email, token);
      return { status: 201, ok: true };
    });
  } catch (error) {
    if (error?.code === "email_delivery_failed") return { status: 503, error: "invitation_email_unavailable" };
    throw error;
  }
}
