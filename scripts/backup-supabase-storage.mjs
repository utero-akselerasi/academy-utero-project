import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

const hosts = { develop: "20.20.20.173", production: "20.20.20.3" };
const usage = `Backup Storage read-only (Node 24+, OpenSSH client, tar lokal, remote tar/find/sha256sum).
  node scripts/backup-supabase-storage.mjs --target develop|production --source /absolute/storage/path --destination /local/backup --user ssh-user --run-id YYYYMMDD-HHMMSS
  node scripts/backup-supabase-storage.mjs --verify true --target develop|production --destination /local/backup --run-id YYYYMMDD-HHMMSS

Source = direktori backend file Storage pada host (bukan metadata DB); tentukan dari deployment masing-masing.
Destination menghasilkan <destination>/<target>/<run-id>/files dan manifest.json. Transfer memakai stream
SSH ke tar lokal tanpa file arsip sementara. Retry run-id gagal memakai .incoming dan hanya mengirim file
yang belum cocok; jangan hapus .incoming. Snapshot selesai hanya diverifikasi.
Gunakan akun SSH read-only ke source, SSH host key terverifikasi, dan tujuan lokal aman (bukan repo).
Tidak membuat snapshot atomik: hentikan penulisan Storage atau pakai snapshot filesystem untuk konsistensi.
Manifest tidak memuat nama file, path, host, user, atau isi file; direktori files tetap mengandung PII.
Backup ini tidak mencakup metadata storage.objects / database; backup database terpisah diperlukan.`;

export function parseOptions(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!key?.startsWith("--") || !args[index + 1] || Object.hasOwn(options, key)) throw new Error("Argumen tidak valid");
    options[key] = args[index + 1];
  }
  const allowed = new Set(["--target", "--source", "--destination", "--user", "--run-id", "--verify"]);
  if (Object.keys(options).some((key) => !allowed.has(key))) throw new Error("Argumen tidak dikenal");
  const verify = options["--verify"] === "true";
  if (options["--verify"] && !verify) throw new Error("Gunakan --verify true");
  const target = options["--target"];
  if (!Object.hasOwn(hosts, target)) throw new Error("Target wajib develop atau production");
  const runId = options["--run-id"];
  if (!/^\d{8}-\d{6}$/.test(runId ?? "")) throw new Error("Run ID wajib YYYYMMDD-HHMMSS");
  const destination = options["--destination"];
  if (!destination || !path.isAbsolute(destination)) throw new Error("Destination wajib path absolut");
  if (verify) {
    if (options["--source"] || options["--user"]) throw new Error("Verify hanya memakai target, destination, run-id");
  } else if (!/^\/[A-Za-z0-9_./-]+$/.test(options["--source"] ?? "") || options["--source"].includes("..") ||
    options["--source"] === "/" || !/^[a-z_][a-z0-9_-]*$/.test(options["--user"] ?? "")) {
    throw new Error("Source absolut dan user SSH aman wajib diisi");
  }
  return { target, runId, destination, source: options["--source"], user: options["--user"], verify };
}

function execute(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.resume();
    child.on("error", () => reject(new Error(`${command} gagal dijalankan`)));
    child.on("close", (code) => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${command} gagal (kode ${code})`)));
  });
}

function validateRelativePath(name) {
  const segments = name.split("/").slice(1);
  if (!name.startsWith("./") || name.includes("\0") || segments.some((segment) =>
    !segment || segment === "." || segment === ".." || /[\\:<>|?*\x00-\x1f]/.test(segment) ||
    /[. ]$/.test(segment) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) {
    throw new Error("Path file tidak aman");
  }
}

export function parseHashes(output) {
  const result = new Map();
  const entries = output.toString("utf8").split("\0");
  if (entries.pop() !== "") throw new Error("Hash remote tidak lengkap");
  for (const entry of entries) {
    const match = /^([a-f0-9]{64}) [ *](\.\/[^\0]+)$/.exec(entry);
    if (!match || result.has(match[2])) throw new Error("Hash remote tidak valid");
    validateRelativePath(match[2]);
    result.set(match[2], match[1]);
  }
  return result;
}

async function hashFile(file) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}

async function localHashes(root) {
  const hashes = new Map();
  async function walk(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = `${prefix}/${entry.name}`;
      validateRelativePath(`.${relative}`);
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file, relative);
      else if (entry.isFile()) hashes.set(`.${relative}`, await hashFile(file));
      else throw new Error("Backup memuat tipe file tidak aman");
    }
  }
  await walk(root, "");
  return hashes;
}

export function remoteCommands(source) {
  if (!/^\/[A-Za-z0-9_./-]+$/.test(source) || source.includes("..") || source === "/") throw new Error("Source tidak aman");
  const prefix = `cd '${source}' && `;
  return {
    types: `${prefix}test -z "$(find . ! -type f ! -type d -print -quit)"`,
    hashes: `${prefix}find . -type f -exec sha256sum -z -- {} +`,
    archive: `${prefix}tar --verbatim-files-from --null --files-from=- --no-recursion -cf -`,
  };
}

export function encodePathList(paths) {
  if (!paths.length) return Buffer.alloc(0);
  for (const name of paths) validateRelativePath(name);
  return Buffer.from(`${paths.join("\0")}\0`, "utf8");
}

async function streamArchive(sshArgs, destination, paths) {
  if (paths.length === 0) return;
  await execute("tar", ["--version"]);
  const ssh = spawn("ssh", sshArgs, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const tar = spawn("tar", ["-xpf", "-", "-C", destination], { shell: false, windowsHide: true, stdio: ["pipe", "ignore", "pipe"] });
  ssh.stderr.resume();
  tar.stderr.resume();
  ssh.stdin.on("error", () => {});
  const sshClosed = new Promise((resolve, reject) => {
    ssh.on("error", () => reject(new Error("ssh gagal dijalankan")));
    ssh.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ssh gagal (kode ${code})`)));
  });
  const tarClosed = new Promise((resolve, reject) => {
    tar.on("error", () => reject(new Error("tar gagal dijalankan")));
    tar.on("close", (code) => code === 0 ? resolve() : reject(new Error(`tar gagal (kode ${code})`)));
  });
  try {
    ssh.stdin.end(encodePathList(paths));
    await Promise.all([pipeline(ssh.stdout, tar.stdin), sshClosed, tarClosed]);
  } catch {
    ssh.kill();
    tar.kill();
    throw new Error("Stream SSH/tar gagal; staging dipertahankan untuk retry.");
  }
}

export function diffHashes(remote, local) {
  const transfer = [];
  const extra = [];
  for (const [name, hash] of remote) {
    if (local.get(name) !== hash) transfer.push(name);
  }
  for (const name of local.keys()) {
    if (!remote.has(name)) extra.push(name);
  }
  transfer.sort();
  extra.sort();
  return { transfer, extra };
}

async function removeExtraFiles(root, names) {
  const resolvedRoot = await realpath(root);
  for (const name of names) {
    validateRelativePath(name);
    const target = path.resolve(root, ...name.slice(2).split("/"));
    if (path.dirname(target) !== resolvedRoot && !path.dirname(target).startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error("Path file ekstra keluar dari staging");
    }
    const metadata = await lstat(target);
    if (!metadata.isFile()) throw new Error("File ekstra bukan file reguler");
    await rm(target);
  }
}

export function assertMatching(expected, actual) {
  if (expected.size !== actual.size || [...expected].some(([name, hash]) => actual.get(name) !== hash)) {
    throw new Error("Integritas gagal: jumlah file atau SHA-256 berbeda");
  }
}

function manifestFor(target, runId, hashes) {
  return {
    version: 1, target, runId, algorithm: "sha256", fileCount: hashes.size,
    files: [...hashes].map(([name, sha256]) => ({ pathDigest: createHash("sha256").update(name).digest("hex"), sha256 }))
      .sort((first, second) => first.pathDigest.localeCompare(second.pathDigest)),
  };
}

async function ensureSafeDirectory(directory) {
  await mkdir(directory, { recursive: true });
  if (!(await lstat(directory)).isDirectory() || (await realpath(directory)) !== path.resolve(directory)) {
    throw new Error("Direktori backup harus nyata, bukan symlink");
  }
}

async function pathExists(file) {
  return lstat(file).then(() => true, (error) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
}

async function writeManifest(manifestPath, manifest) {
  const handle = await open(manifestPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

export async function backup(options) {
  const directory = path.join(options.destination, options.target, options.runId);
  const files = path.join(directory, "files");
  const staging = path.join(directory, ".incoming");
  await ensureSafeDirectory(options.destination);
  await ensureSafeDirectory(path.join(options.destination, options.target));
  await ensureSafeDirectory(directory);
  const manifestPath = path.join(directory, "manifest.json");
  const existing = await readFile(manifestPath, "utf8").then(JSON.parse, (error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing && (existing.target !== options.target || existing.runId !== options.runId || existing.version !== 1)) {
    throw new Error("Manifest tidak sesuai target/run-id");
  }
  if (options.verify) {
    if (!existing) throw new Error("Manifest belum tersedia");
    await ensureSafeDirectory(files);
    const actual = await localHashes(files);
    const expected = new Map(existing.files.map(({ pathDigest, sha256 }) => [pathDigest, sha256]));
    const obtained = new Map([...actual].map(([name, sha256]) => [createHash("sha256").update(name).digest("hex"), sha256]));
    assertMatching(expected, obtained);
    if (existing.fileCount !== actual.size) throw new Error("Jumlah file tidak cocok");
    return existing.fileCount;
  }
  const remote = `${options.user}@${hosts[options.target]}`;
  const commands = remoteCommands(options.source);
  const sshBase = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", remote];
  if (existing) {
    await ensureSafeDirectory(files);
    const actual = await localHashes(files);
    const expected = new Map(existing.files.map(({ pathDigest, sha256 }) => [pathDigest, sha256]));
    const obtained = new Map([...actual].map(([name, sha256]) => [createHash("sha256").update(name).digest("hex"), sha256]));
    assertMatching(expected, obtained);
    if (existing.fileCount !== actual.size) throw new Error("Jumlah file tidak cocok");
    return actual.size;
  }
  await execute("ssh", [...sshBase, commands.types]);
  const before = parseHashes(await execute("ssh", [...sshBase, commands.hashes]));
  if (await pathExists(files)) {
    await ensureSafeDirectory(files);
    const recovered = await localHashes(files);
    assertMatching(before, recovered);
    await writeManifest(manifestPath, manifestFor(options.target, options.runId, recovered));
    return recovered.size;
  }
  await ensureSafeDirectory(staging);
  const localBefore = await localHashes(staging);
  const differences = diffHashes(before, localBefore);
  try {
    await removeExtraFiles(staging, differences.extra);
    await streamArchive([...sshBase, commands.archive], staging, differences.transfer);
  } catch {
    throw new Error("Transfer gagal; staging dipertahankan untuk retry.");
  }
  const local = await localHashes(staging);
  const after = parseHashes(await execute("ssh", [...sshBase, commands.hashes]));
  assertMatching(before, after);
  assertMatching(after, local);
  const manifest = manifestFor(options.target, options.runId, after);
  await rename(staging, files);
  await writeManifest(manifestPath, manifest);
  return after.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log(usage);
    else console.log(`Integritas ${options.target}: ${await backup(options)} file cocok.`);
  } catch (error) {
    console.error(`Backup gagal: ${error.message}\n${usage}`);
    process.exitCode = 1;
  }
}
