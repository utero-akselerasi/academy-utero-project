import { readCookie, sessionDigest } from "./session.mjs";

export async function loadIdentity(db, request, cookieName) {
  const token = readCookie(request.headers.cookie, cookieName);
  if (!token) return null;
  const result = await db.query(
    `select u.id, u.email, p.full_name,
       coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') roles,
       coalesce(array_agg(distinct perm.code) filter (where perm.code is not null), '{}') permissions
     from auth.sessions s
     join auth.users u on u.id = s.user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())
     left join utero_academy.user_profiles p on p.id = u.id
     left join utero_academy.user_roles ur on ur.user_id = u.id
     left join utero_academy.roles r on r.id = ur.role_id and r.is_assignable
       and r.code in ('super_admin', 'admin', 'school', 'intern', 'applicant')
     left join utero_academy.role_permissions rp on rp.role_id = r.id
     left join utero_academy.permissions perm on perm.id = rp.permission_id
     where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and coalesce(p.is_active, true)
     group by u.id, u.email, p.full_name`,
    [sessionDigest(token)],
  );
  if (!result.rows[0]) return null;
  return { ...result.rows[0], token, userId: result.rows[0].id };
}

export function requireIdentity(request, reply) {
  if (request.identity) return request.identity;
  reply.code(401).send({ error: "authentication_required" });
  return null;
}

export function requirePermission(request, reply, allowed) {
  const identity = requireIdentity(request, reply);
  if (!identity) return null;
  if (identity.roles.includes("super_admin") || allowed.some((code) => identity.permissions.includes(code))) return identity;
  reply.code(403).send({ error: "forbidden" });
  return null;
}

export function requireRolePermission(request, reply, allowedRoles, allowedPermissions) {
  const identity = requirePermission(request, reply, allowedPermissions);
  if (!identity) return null;
  if (allowedRoles.some((role) => identity.roles.includes(role))) return identity;
  reply.code(403).send({ error: "forbidden" });
  return null;
}
