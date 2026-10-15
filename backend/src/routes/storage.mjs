import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { link, lstat, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { getBucket } from "../storage/buckets.mjs";
import { resolveObjectFile } from "../storage/path.mjs";
import { verifyContentType } from "../storage/content.mjs";
import { createStorageToken, verifyStorageToken } from "../storage/signing.mjs";
import { requireIdentity, requirePermission } from "../auth/identity.mjs";

function writePermissions(bucket) {
  if (["gallery", "article", "mentor", "school-logo"].includes(bucket)) return ["cms.write"];
  if (bucket === "learning") return ["lms.manage"];
  if (bucket === "task") return ["tasks.submit", "tasks.manage"];
  if (bucket === "daily-report") return ["daily_reports.submit", "daily_reports.review"];
  if (bucket === "certificate") return ["certificates.generate"];
  return [];
}

async function ownsPrivateObject(db, identity, bucket, objectPath) {
  return db.transaction(identity, async (client) => {
    const result = await client.query(
      "select 1 from academy_storage.objects where bucket_id = $1 and name = $2 and owner_id = $3 and deleted_at is null",
      [bucket, objectPath, identity.id],
    );
    return Boolean(result.rows[0]);
  });
}

async function canReadPrivate(db, identity, bucket, objectPath) {
  if (identity.roles.some((role) => role === "admin" || role === "super_admin")) return true;
  return db.transaction(identity, async (client) => {
    const owned = await client.query(
      "select 1 from academy_storage.objects where bucket_id = $1 and name = $2 and owner_id = $3 and deleted_at is null",
      [bucket, objectPath, identity.id],
    );
    if (owned.rows[0]) return true;
    if (!identity.roles.includes("intern") || (bucket !== "learning" && bucket !== "task")) return false;
    const shared = await client.query(
      "select utero_academy.can_read_shared_attachment($1,$2) as allowed", [bucket, objectPath],
    );
    return shared.rows[0]?.allowed === true;
  });
}

export async function storageRoutes(app, options) {
  const { db, config } = options;

  app.post("/v1/storage/sign", async (request, reply) => {
    const identity = requireIdentity(request, reply);
    if (!identity) return;
    const bucketName = String(request.body?.bucket || "");
    const bucket = getBucket(bucketName);
    if (!bucket || bucket.public) return reply.code(400).send({ error: "private_bucket_required" });
    let resolved;
    try { resolved = resolveObjectFile(config.storageRoot, bucketName, String(request.body?.path || "")); }
    catch { return reply.code(400).send({ error: "invalid_object_path" }); }
    if (!(await canReadPrivate(db, identity, bucketName, resolved.normalized))) return reply.code(403).send({ error: "forbidden" });
    const expiresIn = Number(request.body?.expiresIn || 3600);
    if (!Number.isSafeInteger(expiresIn) || expiresIn < 60 || expiresIn > 21_600) return reply.code(400).send({ error: "invalid_expiry" });
    const expiresAt = Date.now() + expiresIn * 1000;
    return { token: createStorageToken(config.storageSigningSecret, bucketName, resolved.normalized, expiresAt), expiresAt };
  });

  app.post("/v1/storage/:bucket", async (request, reply) => {
    const bucketName = request.params.bucket;
    const bucket = getBucket(bucketName);
    if (!bucket) return reply.code(404).send({ error: "bucket_not_found" });
    const required = writePermissions(bucketName);
    const identity = required.length ? requirePermission(request, reply, required) : requireIdentity(request, reply);
    if (!identity) return;
    const requestedPath = request.headers["x-object-path"];
    if (typeof requestedPath !== "string") return reply.code(400).send({ error: "missing_object_path" });
    let resolved;
    try { resolved = resolveObjectFile(config.storageRoot, bucketName, requestedPath); }
    catch { return reply.code(400).send({ error: "invalid_object_path" }); }
    if (["academy-private", "avatars", "selection-answers"].includes(bucketName) &&
        !identity.roles.some((role) => role === "admin" || role === "super_admin") &&
        !resolved.normalized.startsWith(`${identity.id}/`)) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const file = await request.file({ limits: { files: 1, fileSize: bucket.maxBytes } });
    if (!file || !bucket.mime.includes(file.mimetype)) return reply.code(415).send({ error: "unsupported_media_type" });
    await mkdir(path.dirname(resolved.target), { recursive: true });
    const temporary = `${resolved.target}.${randomUUID()}.upload`;
    const digest = createHash("sha256");
    let byteSize = 0;
    let sample = Buffer.alloc(0);
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        byteSize += chunk.length;
        digest.update(chunk);
        if (sample.length < 4100) sample = Buffer.concat([sample, chunk.subarray(0, 4100 - sample.length)]);
        callback(null, chunk);
      },
    });
    let linked = false;
    try {
      await pipeline(file.file, meter, createWriteStream(temporary, { flags: "wx", mode: 0o600 }));
      if (file.file.truncated || byteSize > bucket.maxBytes) throw new Error("file_too_large");
      if (!(await verifyContentType(sample, file.mimetype))) throw new Error("unsupported_media_type");
      try {
        await link(temporary, resolved.target);
        linked = true;
      } catch (error) {
        if (error.code === "EEXIST") return reply.code(409).send({ error: "object_exists" });
        throw error;
      }
      await db.query(
        `insert into academy_storage.objects (bucket_id, name, owner_id, original_name, mime_type, byte_size, sha256)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [bucketName, resolved.normalized, identity.id, file.filename, file.mimetype, byteSize, digest.digest("hex")],
      );
      return reply.code(201).send({ bucket: bucketName, path: resolved.normalized, byteSize });
    } catch (error) {
      if (linked) await rm(resolved.target, { force: true });
      if (error.message === "file_too_large") return reply.code(413).send({ error: "file_too_large" });
      if (error.message === "unsupported_media_type") return reply.code(415).send({ error: "unsupported_media_type" });
      throw error;
    } finally {
      await rm(temporary, { force: true });
    }
  });

  app.get("/v1/storage/:bucket/*", async (request, reply) => {
    const bucketName = request.params.bucket;
    const bucket = getBucket(bucketName);
    if (!bucket) return reply.code(404).send({ error: "bucket_not_found" });
    let resolved;
    try { resolved = resolveObjectFile(config.storageRoot, bucketName, request.params["*"]); }
    catch { return reply.code(400).send({ error: "invalid_object_path" }); }
    if (!bucket.public) {
      const signed = verifyStorageToken(config.storageSigningSecret, request.query?.token, bucketName, resolved.normalized);
      if (!signed) {
        const identity = requireIdentity(request, reply);
        if (!identity) return;
        if (!(await canReadPrivate(db, identity, bucketName, resolved.normalized))) return reply.code(403).send({ error: "forbidden" });
      }
    }
    const metadata = await db.query(
      "select mime_type, byte_size from academy_storage.objects where bucket_id = $1 and name = $2 and deleted_at is null",
      [bucketName, resolved.normalized],
    );
    if (!metadata.rows[0]) return reply.code(404).send({ error: "object_not_found" });
    try {
      const file = await lstat(resolved.target);
      if (!file.isFile() || file.isSymbolicLink()) return reply.code(404).send({ error: "object_bytes_missing" });
    } catch { return reply.code(404).send({ error: "object_bytes_missing" }); }
    reply.type(metadata.rows[0].mime_type).header("content-length", metadata.rows[0].byte_size);
    return reply.send(createReadStream(resolved.target));
  });

  app.delete("/v1/storage/:bucket/*", async (request, reply) => {
    const bucketName = request.params.bucket;
    const bucket = getBucket(bucketName);
    if (!bucket) return reply.code(404).send({ error: "bucket_not_found" });
    const required = writePermissions(bucketName);
    const identity = required.length ? requirePermission(request, reply, required) : requireIdentity(request, reply);
    if (!identity) return;
    let resolved;
    try { resolved = resolveObjectFile(config.storageRoot, bucketName, request.params["*"]); }
    catch { return reply.code(400).send({ error: "invalid_object_path" }); }
    if (!identity.roles.some((role) => role === "admin" || role === "super_admin")) {
      if (!(await ownsPrivateObject(db, identity, bucketName, resolved.normalized))) return reply.code(403).send({ error: "forbidden" });
    }
    await db.query("update academy_storage.objects set deleted_at = now(), updated_at = now() where bucket_id = $1 and name = $2", [bucketName, resolved.normalized]);
    await rm(resolved.target, { force: true });
    return reply.code(204).send();
  });
}
