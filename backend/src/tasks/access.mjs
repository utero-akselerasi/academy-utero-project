export const validId = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function canManageTasks(identity) {
  return identity.roles.includes("super_admin") || identity.roles.includes("admin");
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
  if (canManageTasks(identity)) return { card };
  const profileId = await internProfile(client, identity);
  return profileId && profileId === card.intern_id ? { card } : { error: "forbidden" };
}

export function sendAccessError(reply, error) {
  if (error === "card_not_found") return reply.code(404).send({ error });
  return reply.code(403).send({ error: "forbidden" });
}
