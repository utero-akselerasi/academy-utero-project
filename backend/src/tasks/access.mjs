export const validId = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function canManageTasks(identity) {
  return identity.roles.includes("super_admin") || (identity.roles.includes("admin") && identity.permissions.includes("tasks.manage"));
}

export async function internProfile(client, identity) {
  const result = await client.query(
    "select id from utero_academy.intern_profiles where user_id = $1 and status = 'active'",
    [identity.id],
  );
  return result.rows[0]?.id ?? null;
}

export async function cardAccess(client, identity, cardId) {
  const result = await client.query(
    `select c.id, c.intern_id, l.board_id
       from utero_academy.task_cards c
       join utero_academy.task_lists l on l.id = c.list_id
      where c.id = $1`,
    [cardId],
  );
  const card = result.rows[0];
  if (!card) return { error: "card_not_found" };
  if (identity.roles.includes("super_admin")) return { card };
  if (identity.roles.includes("admin")) {
    if (!card.intern_id) return { card };
    const mentor = await client.query("select id from utero_academy.mentor_profiles where user_id = $1", [identity.id]);
    if (!mentor.rows[0]) return { error: "mentor_setup_required" };
    const assigned = await client.query(
      "select 1 from utero_academy.mentor_assignments where mentor_id = $1 and intern_id = $2",
      [mentor.rows[0].id, card.intern_id],
    );
    return assigned.rowCount ? { card } : { error: "forbidden" };
  }
  const profileId = await internProfile(client, identity);
  return profileId && profileId === card.intern_id ? { card } : { error: "forbidden" };
}

export function sendAccessError(reply, error) {
  if (error === "card_not_found") return reply.code(404).send({ error });
  if (error === "mentor_setup_required") return reply.code(409).send({ error });
  return reply.code(403).send({ error: "forbidden" });
}
