import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getBucket } from "../storage/buckets.mjs";
import { verifyContentType } from "../storage/content.mjs";
import { resolveObjectFile } from "../storage/path.mjs";

const EXTENSIONS = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/gif", "gif"], ["image/webp", "webp"],
  ["application/pdf", "pdf"], ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

export async function storeDomainObject({ db, config, identity, bucketName, prefix, upload, cleanups }) {
  const bucket = getBucket(bucketName);
  if (!bucket || !bucket.mime.includes(upload.mimeType) || upload.buffer.length > bucket.maxBytes) {
    const error = new Error("unsupported_upload");
    error.statusCode = upload.buffer.length > (bucket?.maxBytes ?? 0) ? 413 : 415;
    throw error;
  }
  if (!(await verifyContentType(upload.buffer.subarray(0, 4100), upload.mimeType))) {
    const error = new Error("unsupported_upload");
    error.statusCode = 415;
    throw error;
  }
  const extension = EXTENSIONS.get(upload.mimeType);
  if (!extension) throw new Error("unsupported_upload");
  const objectPath = `${prefix}/${randomUUID()}.${extension}`;
  const resolved = resolveObjectFile(config.storageRoot, bucketName, objectPath);
  await mkdir(path.dirname(resolved.target), { recursive: true });
  const temporary = `${resolved.target}.${randomUUID()}.upload`;
  await writeFile(temporary, upload.buffer, { flag: "wx", mode: 0o600 });
  try {
    await link(temporary, resolved.target);
  } finally {
    await rm(temporary, { force: true });
  }
  cleanups.push(async () => {
    await db.query("update academy_storage.objects set deleted_at = now(), updated_at = now() where bucket_id = $1 and name = $2 and owner_id = $3", [bucketName, resolved.normalized, identity.id]);
    await rm(resolved.target, { force: true });
  });
  await db.query(
    `insert into academy_storage.objects (bucket_id, name, owner_id, original_name, mime_type, byte_size, sha256)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [bucketName, resolved.normalized, identity.id, upload.fileName, upload.mimeType, upload.buffer.length,
      createHash("sha256").update(upload.buffer).digest("hex")],
  );
  return resolved.normalized;
}

export async function cleanupObjects(cleanups) {
  await Promise.allSettled(cleanups.reverse().map((cleanup) => cleanup()));
}
