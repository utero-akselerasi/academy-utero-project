import path from "node:path";

export function normalizeObjectPath(value) {
  if (typeof value !== "string") throw new Error("Object path wajib string");
  const normalized = value.trim().replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (!normalized || normalized.startsWith("/") || normalized.endsWith("/") || normalized.includes("\0") ||
      parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("Object path tidak aman");
  }
  return parts.join("/");
}

export function resolveObjectFile(storageRoot, bucket, objectPath) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(bucket)) throw new Error("Bucket tidak aman");
  const normalized = normalizeObjectPath(objectPath);
  const bucketRoot = path.resolve(storageRoot, bucket);
  const target = path.resolve(bucketRoot, ...normalized.split("/"));
  if (target !== bucketRoot && !target.startsWith(`${bucketRoot}${path.sep}`)) throw new Error("Object path keluar dari storage root");
  return { normalized, target };
}
