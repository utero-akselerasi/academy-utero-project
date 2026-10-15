import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";

const REQUIRED_RELATIONS = [
  "auth.users",
  "utero_academy.roles",
  "utero_academy.user_profiles",
  "academy_storage.objects",
  "public.academy_backend_migrations",
];

export async function checkReadiness(db, storageRoot) {
  const relationQuery = REQUIRED_RELATIONS.map((_, index) => `to_regclass($${index + 1}) relation_${index + 1}`).join(", ");
  const [relations, storageMetadata] = await Promise.all([
    db.query(`select ${relationQuery}`, REQUIRED_RELATIONS),
    stat(storageRoot),
  ]);
  if (!relations.rows[0] || Object.values(relations.rows[0]).some((value) => value === null)) {
    throw new Error("schema aplikasi belum lengkap");
  }
  if (!storageMetadata.isDirectory()) throw new Error("storage root bukan direktori");
  await access(storageRoot, constants.R_OK | constants.W_OK);
}
