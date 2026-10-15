import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const academyBuckets = new Set(["academy-private", "daily-report", "task", "certificate", "learning"]);
export const BASELINE_VERSIONS = Object.freeze([
  ...Array.from({ length: 29 }, (_, index) => String(index + 1).padStart(4, "0")),
  "0030a", "0030b", "0030c", "0030d", "0030e", "0030f", "0031", "0032a", "0032b",
  "0033", "0034", "0035", "0036", "0037",
]);

export function verifyIsolation(snapshot) {
  const errors = [];
  const bucket = snapshot.buckets?.find((entry) => entry.id === "academy-private");
  if (!bucket || bucket.public !== false || Number(bucket.file_size_limit) !== 20971520) errors.push("Konfigurasi academy-private tidak sesuai");
  const policies = snapshot.policies;
  if (!Array.isArray(policies)) errors.push("Snapshot policy Storage wajib tersedia");
  else {
    if (policies.some((entry) => entry.policyname === "Public Access" || entry.qual?.trim().toLowerCase() === "true")) errors.push("Policy Storage global terbuka");
    if (policies.some((entry) => academyBuckets.has(entry.bucket) && entry.roles?.some((role) => ["anon", "authenticated"].includes(role)) && entry.cmd !== "SELECT")) errors.push("Policy tulis bucket Academy terbuka");
    const soundpub = policies.filter((entry) => entry.bucket === "avatars")
      .map(({ policyname, cmd, roles, qual, with_check }) => ({ policyname, cmd, roles, qual, with_check }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    const digest = createHash("sha256").update(JSON.stringify(soundpub)).digest("hex");
    if (!snapshot.soundpubPolicyDigest || digest !== snapshot.soundpubPolicyDigest) errors.push("Policy SoundPub berubah atau fingerprint tidak ada");
  }
  const versions = snapshot.versions;
  if (!Array.isArray(versions) || BASELINE_VERSIONS.some((version) => !versions.includes(version))) errors.push("Riwayat baseline 0001–0037 tidak lengkap");
  if (!Array.isArray(snapshot.smoke) || !snapshot.smoke.length || snapshot.smoke.some((entry) =>
    !entry.path || !["academy-private", "daily-report"].includes(entry.bucket) || entry.status !== 200 ||
    !Number.isSafeInteger(entry.size) || entry.size <= 0 || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "") || entry.sha256 !== entry.expectedSha256)) errors.push("Smoke object Storage gagal atau bukti tidak lengkap");
  return { ready: errors.length === 0, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Gunakan: node scripts/verify-phase13-isolation.mjs snapshot.json");
    const report = verifyIsolation(JSON.parse(readFileSync(process.argv[2], "utf8")));
    console.log(JSON.stringify(report));
    if (!report.ready) process.exitCode = 1;
  } catch (error) {
    console.error(`Verifikasi isolasi gagal: ${error.message}`);
    process.exitCode = 1;
  }
}
