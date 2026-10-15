import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromFile } from "file-type";
import pg from "pg";
import { BUCKETS } from "../src/storage/buckets.mjs";
import { resolveObjectFile } from "../src/storage/path.mjs";
import { resolveSourceOwner } from "../src/storage/source-owner.mjs";

const sourceRoot = path.resolve(process.env.STORAGE_IMPORT_SOURCE || "");
const targetRoot = path.resolve(process.env.STORAGE_ROOT || "");
const databaseUrl = process.env.DATABASE_URL;
if (!process.env.STORAGE_IMPORT_SOURCE || !process.env.STORAGE_ROOT || !databaseUrl) throw new Error("STORAGE_IMPORT_SOURCE, STORAGE_ROOT, dan DATABASE_URL wajib diisi");
if (process.env.CONFIRM_STORAGE_IMPORT !== "copy-to-local-storage") throw new Error("Set CONFIRM_STORAGE_IMPORT=copy-to-local-storage");
if (sourceRoot === targetRoot || targetRoot === path.parse(targetRoot).root) throw new Error("Source/target storage tidak aman");

async function digest(file) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); size += chunk.length; }
  return { sha256: hash.digest("hex"), size };
}

async function walk(root, prefix = "") {
  const result = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlink ditolak: ${relative}`);
    if (entry.isDirectory()) result.push(...await walk(root, relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
let copied = 0;
let skipped = 0;
try {
  for (const relative of await walk(sourceRoot)) {
    const [bucket, ...objectParts] = relative.replaceAll("\\", "/").split("/");
    if (!BUCKETS[bucket] || objectParts.length === 0) throw new Error(`Bucket/path tidak dikenal: ${relative}`);
    const objectPath = objectParts.join("/");
    const source = path.resolve(sourceRoot, ...relative.split("/"));
    const sourceMetadata = await lstat(source);
    if (!sourceMetadata.isFile() || sourceMetadata.isSymbolicLink()) throw new Error(`Source bukan file reguler: ${relative}`);
    const { target, normalized } = resolveObjectFile(targetRoot, bucket, objectPath);
    const expected = await digest(source);
    const sourceObject = await client.query(
      `select owner::text, owner_id, metadata->>'mimetype' mime_type
       from storage.objects where bucket_id = $1 and name = $2`,
      [bucket, normalized],
    );
    const ownerId = resolveSourceOwner(sourceObject.rows[0]?.owner, sourceObject.rows[0]?.owner_id);
    const detected = await fileTypeFromFile(source);
    const mimeType = sourceObject.rows[0]?.mime_type || detected?.mime || "application/octet-stream";
    let existing = null;
    try { existing = await digest(target); } catch (error) { if (error.code !== "ENOENT") throw error; }
    let createdTarget = false;
    if (existing?.sha256 === expected.sha256 && existing.size === expected.size) {
      skipped += 1;
    } else {
      if (existing) throw new Error(`Target berbeda, hapus manual setelah audit: ${relative}`);
      await mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.importing`;
      await copyFile(source, temporary);
      const copiedDigest = await digest(temporary);
      if (copiedDigest.sha256 !== expected.sha256 || copiedDigest.size !== expected.size) throw new Error(`Verifikasi copy gagal: ${relative}`);
      await copyFile(temporary, target, constants.COPYFILE_EXCL);
      await rm(temporary, { force: true });
      createdTarget = true;
      copied += 1;
    }
    try {
      await client.query("begin");
      await client.query(
        `insert into academy_storage.objects (bucket_id, name, owner_id, mime_type, byte_size, sha256)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (bucket_id, name) do update set owner_id = excluded.owner_id, mime_type = excluded.mime_type,
           byte_size = excluded.byte_size, sha256 = excluded.sha256, deleted_at = null, updated_at = now()`,
        [bucket, normalized, ownerId, mimeType, expected.size, expected.sha256],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      if (createdTarget) await rm(target, { force: true });
      throw error;
    }
  }
  console.log(JSON.stringify({ copied, skipped }));
} finally {
  await client.end();
}
