const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveSourceOwner(owner, ownerId) {
  const typedOwner = owner == null ? null : String(owner);
  const textOwner = typeof ownerId === "string" && ownerId.trim() ? ownerId.trim() : null;
  if (typedOwner && textOwner && typedOwner.toLowerCase() !== textOwner.toLowerCase()) {
    throw new Error("Metadata owner Supabase konflik");
  }
  const resolved = typedOwner || textOwner;
  if (resolved && !UUID.test(resolved)) throw new Error("Metadata owner Supabase bukan UUID valid");
  return resolved;
}
