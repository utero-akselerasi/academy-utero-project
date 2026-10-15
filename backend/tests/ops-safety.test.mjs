import assert from "node:assert/strict";
import { appendFile, chmod, mkdir, mkdtemp, readFile, symlink, utimes, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = path.resolve(new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

function shellAvailable() {
  return process.platform !== "win32" && spawnSync("sh", ["-c", "exit 0"], { stdio: "ignore" }).status === 0;
}

function run(script, env = {}) {
  return spawnSync("sh", [path.join(repositoryRoot, "backend", "scripts", script)], {
    cwd: repositoryRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("skrip operasi memakai guard integritas dan anti-symlink", async () => {
  const names = ["backup-selfhosted.sh", "verify-selfhosted-backup.sh", "replicate-backup-offsite.sh", "prune-selfhosted-backups.sh", "restore-selfhosted.sh"];
  const scripts = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readFile(new URL(`../scripts/${name}`, import.meta.url), "utf8")])));

  assert.match(scripts["backup-selfhosted.sh"], /storage\.files\.sha256\.before/);
  assert.match(scripts["verify-selfhosted-backup.sh"], /Isi arsip storage tidak cocok dengan manifest/);
  assert.match(scripts["replicate-backup-offsite.sh"], /realpath/);
  assert.match(scripts["prune-selfhosted-backups.sh"], /verify-selfhosted-backup\.sh/);
  assert.match(scripts["restore-selfhosted.sh"], /pre-restore-/);
  assert.match(scripts["restore-selfhosted.sh"], /Role PostgreSQL prerequisite belum tersedia/);
  assert.match(scripts["restore-selfhosted.sh"], /--single-transaction/);
  assert.match(scripts["restore-selfhosted.sh"], /\.backupRestore\.XXXXXX/);
  assert.match(scripts["restore-selfhosted.sh"], /chmod 600 "\$evidence_stage"/);
  assert.match(scripts["restore-selfhosted.sh"], /mv "\$evidence_stage" "\$evidence_root\/backupRestore\.json"/);
});

test("prune menolak root symlink dan tidak menghapus target", { skip: !shellAvailable() }, async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "academy-prune-symlink-"));
  const realRoot = path.join(temporary, "real");
  const linkedRoot = path.join(temporary, "linked");
  const protectedFile = path.join(realRoot, "keep.txt");
  await mkdir(realRoot);
  await writeFile(protectedFile, "keep");
  await symlink(realRoot, linkedRoot, "dir");

  const result = run("prune-selfhosted-backups.sh", {
    RETENTION_ROOT: linkedRoot,
    RETENTION_DAYS: "0",
    RETENTION_MINIMUM_KEEP: "0",
    CONFIRM_PRUNE: "prune-expired-backups",
  });

  assert.notEqual(result.status, 0);
  assert.equal(await readFile(protectedFile, "utf8"), "keep");
});

test("backup tervalidasi dan perubahan artefak terdeteksi", { skip: !shellAvailable() }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-backup-valid-"));
  const backupRoot = path.join(root, "backups");
  const storageRoot = path.join(root, "storage");
  const binRoot = path.join(root, "bin");
  await Promise.all([mkdir(backupRoot), mkdir(storageRoot), mkdir(binRoot)]);
  await mkdir(path.join(storageRoot, "documents"));
  await writeFile(path.join(storageRoot, "documents", "report.txt"), "immutable payload\n");

  const fakePgDump = path.join(binRoot, "pg_dump");
  const fakePgRestore = path.join(binRoot, "pg_restore");
  await writeFile(fakePgDump, "#!/bin/sh\nfor argument do case \"$argument\" in --file=*) printf 'fake custom dump\\n' > \"${argument#--file=}\" ;; esac; done\n");
  await writeFile(fakePgRestore, "#!/bin/sh\n[ \"$1\" = --list ] && [ -f \"$2\" ]\n");
  await Promise.all([chmod(fakePgDump, 0o755), chmod(fakePgRestore, 0o755)]);

  const environment = {
    PATH: `${binRoot}${path.delimiter}${process.env.PATH}`,
    DATABASE_URL: "postgresql://tester:secret@postgres:5432/academy",
    STORAGE_ROOT: storageRoot,
    BACKUP_ROOT: backupRoot,
    BACKUP_NAME: "academy-test",
  };
  const backup = run("backup-selfhosted.sh", environment);
  assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`);

  const verify = run("verify-selfhosted-backup.sh", { ...environment, BACKUP_NAME: "academy-test" });
  assert.equal(verify.status, 0, `${verify.stdout}\n${verify.stderr}`);

  await appendFile(path.join(backupRoot, "academy-test", "storage.tar.gz"), "tampered");
  const tampered = run("verify-selfhosted-backup.sh", { ...environment, BACKUP_NAME: "academy-test" });
  assert.notEqual(tampered.status, 0);
});

test("backup gagal bila storage berubah saat pg_dump", { skip: !shellAvailable() }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-backup-race-"));
  const backupRoot = path.join(root, "backups");
  const storageRoot = path.join(root, "storage");
  const binRoot = path.join(root, "bin");
  await Promise.all([mkdir(backupRoot), mkdir(storageRoot), mkdir(binRoot)]);
  await writeFile(path.join(storageRoot, "payload.txt"), "before\n");

  const fakePgDump = path.join(binRoot, "pg_dump");
  await writeFile(fakePgDump, "#!/bin/sh\nprintf 'after\\n' > \"$STORAGE_ROOT/payload.txt\"\nfor argument do case \"$argument\" in --file=*) printf 'fake custom dump\\n' > \"${argument#--file=}\" ;; esac; done\n");
  await chmod(fakePgDump, 0o755);

  const result = run("backup-selfhosted.sh", {
    PATH: `${binRoot}${path.delimiter}${process.env.PATH}`,
    DATABASE_URL: "postgresql://tester:secret@postgres:5432/academy",
    STORAGE_ROOT: storageRoot,
    BACKUP_ROOT: backupRoot,
    BACKUP_NAME: "academy-race-test",
  });

  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Storage berubah selama backup; backup dibatalkan/);
  assert.equal(existsSync(path.join(backupRoot, "academy-race-test")), false);
});

test("prune tidak menghapus direktori tua yang bukan backup tervalidasi", { skip: !shellAvailable() }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-prune-invalid-"));
  const fakeBackup = path.join(root, "academy-old");
  await mkdir(fakeBackup);
  await writeFile(path.join(fakeBackup, "metadata.env"), "BACKUP_FORMAT=1\nBACKUP_NAME=academy-old\n");
  const old = new Date("2020-01-01T00:00:00Z");
  await utimes(fakeBackup, old, old);

  const result = run("prune-selfhosted-backups.sh", {
    RETENTION_ROOT: root,
    RETENTION_DAYS: "1",
    RETENTION_MINIMUM_KEEP: "0",
    CONFIRM_PRUNE: "prune-expired-backups",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(path.join(fakeBackup, "metadata.env"), "utf8"), "BACKUP_FORMAT=1\nBACKUP_NAME=academy-old\n");
  assert.match(result.stderr, /Dilewati, backup tidak valid/);
});

test("restore menolak target database non-produksi tanpa menjalankan pg_restore", { skip: !shellAvailable() }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-restore-invalid-"));
  const backupRoot = path.join(root, "backups");
  const storageRoot = path.join(root, "storage");
  const evidenceRoot = path.join(root, "evidence");
  const binRoot = path.join(root, "bin");
  await Promise.all([mkdir(backupRoot), mkdir(storageRoot), mkdir(evidenceRoot), mkdir(binRoot)]);
  await mkdir(path.join(backupRoot, "broken"));
  const pgRestoreMarker = path.join(root, "pg-restore-called");
  const fakePgRestore = path.join(binRoot, "pg_restore");
  await writeFile(fakePgRestore, `#!/bin/sh\ntouch '${pgRestoreMarker}'\nexit 0\n`);
  await chmod(fakePgRestore, 0o755);

  const result = run("restore-selfhosted.sh", {
    PATH: `${binRoot}${path.delimiter}${process.env.PATH}`,
    DATABASE_URL: "postgresql://tester:secret@postgres:5432/academy_test",
    RESTORE_BACKUP_NAME: "broken",
    CONFIRM_RESTORE: "restore-local-academy",
    STORAGE_ROOT: storageRoot,
    BACKUP_ROOT: backupRoot,
    OPS_EVIDENCE_ROOT: evidenceRoot,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Restore hanya boleh ke database academy/);
  assert.equal(existsSync(pgRestoreMarker), false);
});
