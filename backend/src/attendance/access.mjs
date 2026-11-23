export async function activeInternProfile(client, identity) {
  const result = await client.query(
    "select id from utero_academy.intern_profiles where user_id = $1 and status = 'active'",
    [identity.id],
  );
  return result.rows[0]?.id ?? null;
}

export async function staffScope(client, identity) {
  if (identity.roles.includes("admin") || identity.roles.includes("super_admin")) return null;
  return undefined;
}

export async function requireScopedIntern(client, identity, internId) {
  const scope = await staffScope(client, identity);
  if (scope === undefined) return "setup_required";
  if (scope !== null && !scope.includes(internId)) return "forbidden";
  return null;
}
