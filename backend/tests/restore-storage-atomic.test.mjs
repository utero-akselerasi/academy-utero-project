import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const restoreScript = path.join(repositoryRoot, "backend", "scripts", "restore-selfhosted.sh");
const canUseIsolatedStorageRoot = process.platform === "linux" && process.getuid?.() === 0;

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

async function executable(file, content) {
  await writeFile(file, content);
  await chmod(file, 0o755);
}

async function fixture(mode) {
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-restore-atomic-"));
  const backupRoot = path.join(root, "backups");
  const evidenceRoot = path.join(root, "evidence");
  const payload = path.join(root, "payload");
  const bin = path.join(root, "bin");
  const calls = path.join(root, "calls.log");
  const backup = path.join(backupRoot, "restore-test");
  await Promise.all([mkdir(backup, { recursive: true }), mkdir(evidenceRoot), mkdir(payload), mkdir(bin)]);
  await mkdir(path.join(payload, "bucket"));
  await writeFile(path.join(payload, "bucket", "new.txt"), "new storage\n");
  await writeFile(path.join(backup, "database.dump"), "fake dump\n");
  run("tar", ["-C", payload, "-czf", path.join(backup, "storage.tar.gz"), "."], { stdio: "inherit" });
  const manifest = run("sh", ["-c", "find . -type f -exec sha256sum -- {} \\; | LC_ALL=C sort", "sh"], { cwd: payload });
  assert.equal(manifest.status, 0, manifest.stderr);
  await writeFile(path.join(backup, "storage.files.sha256"), manifest.stdout);
  await writeFile(path.join(backup, "metadata.env"), "BACKUP_FORMAT=1\nBACKUP_NAME=restore-test\nCREATED_AT_UTC=20261015T000000Z\nDATABASE_DUMP_FORMAT=custom\nSTORAGE_ARCHIVE_FORMAT=tar.gz\n");
  const sums = run("sh", ["-c", "sha256sum database.dump storage.tar.gz storage.files.sha256 metadata.env > SHA256SUMS"], { cwd: backup });
  assert.equal(sums.status, 0, sums.stderr);

  await executable(path.join(bin, "pg_restore"), "#!/bin/sh\ncase \" $* \" in *\" --list \"*) printf '%s\\n' '1; 0 0 SCHEMA - academy_storage owner' '2; 0 0 SCHEMA - auth owner' '3; 0 0 SCHEMA - storage owner' '4; 0 0 SCHEMA - utero_academy owner';; *\"--file=\"*) for argument do case \"$argument\" in --file=*) printf '%s\\n' 'select 1;' > \"${argument#--file=}\";; esac; done;; esac\n");
  await executable(path.join(bin, "pg_dump"), "#!/bin/sh\nfor argument do case \"$argument\" in --file=*) printf 'safety dump\\n' > \"${argument#--file=}\";; esac; done\n");
  await executable(path.join(bin, "psql"), `#!/bin/sh
printf 'psql %s\\n' "$*" >> "${calls}"
case " $* " in
  *"select 1"*)
    if [ "${mode}" = "probe" ] || [ "${mode}" = "rollback-fail" ]; then exit 1; fi
    printf '1\\n'
    ;;
  *"rollback.sql"*)
    if [ "${mode}" = "rollback-fail" ]; then exit 1; fi
    ;;
esac
`);
  await executable(path.join(bin, "chown"), "#!/bin/sh\nexit 0\n");

  if (mode === "extract") {
    await executable(path.join(bin, "tar"), "#!/bin/sh\ncase \" $* \" in *\" /srv/.storage.restore.\"*) mkdir -p \"$2/partial\"; printf partial > \"$2/partial/file\"; exit 1;; esac\nexec /bin/tar \"$@\"\n");
  } else if (mode === "swap") {
    await executable(path.join(bin, "mv"), "#!/bin/sh\ncase \"$1:$2\" in /srv/.storage.restore.*:/srv/storage) exit 1;; esac\nexec /bin/mv \"$@\"\n");
  }

  return { root, backupRoot, evidenceRoot, bin, calls };
}

async function executeRestore(mode, environment = {}) {
  const setup = await fixture(mode);
  await rm("/srv/storage", { recursive: true, force: true });
  await mkdir("/srv/storage", { recursive: true });
  await writeFile("/srv/storage/old.txt", "old storage\n");
  const result = run("sh", [restoreScript], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      PATH: `${setup.bin}:${process.env.PATH}`,
      DATABASE_URL: "postgresql://tester:secret@postgres:5432/academy",
      RESTORE_BACKUP_NAME: "restore-test",
      CONFIRM_RESTORE: "restore-local-academy",
      BACKUP_ROOT: setup.backupRoot,
      OPS_EVIDENCE_ROOT: setup.evidenceRoot,
      ...environment,
    },
  });
  return { ...setup, result };
}

test("restore mempertahankan storage lama saat ekstraksi staging gagal", { skip: !canUseIsolatedStorageRoot }, async () => {
  const { root, result } = await executeRestore("extract");
  try {
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(await readFile("/srv/storage/old.txt", "utf8"), "old storage\n");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm("/srv/storage", { recursive: true, force: true });
  }
});

test("restore sukses menulis backupRestore evidence atomik dengan mode ketat", { skip: !canUseIsolatedStorageRoot }, async () => {
  const { root, evidenceRoot, result } = await executeRestore("success");
  try {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const evidencePath = path.join(evidenceRoot, "backupRestore.json");
    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    assert.equal(evidence.gate, "backupRestore");
    assert.equal(evidence.target, "local");
    assert.equal(evidence.status, "PASS");
    assert.deepEqual(evidence.checks, {
      database: { ok: true },
      storage: { ok: true },
      safetyBackup: { ok: true },
    });
    const lifetime = Date.parse(evidence.expiresAt) - Date.parse(evidence.finishedAt);
    assert.ok(lifetime > 0 && lifetime <= 24 * 60 * 60 * 1000);
    const { mode } = await stat(evidencePath);
    assert.equal(mode & 0o777, 0o600);
    assert.deepEqual((await readdir(evidenceRoot)).filter((name) => name.startsWith(".backupRestore.")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm("/srv/storage", { recursive: true, force: true });
  }
});

test("restore production memberi target production pada evidence", { skip: !canUseIsolatedStorageRoot }, async () => {
  const { root, evidenceRoot, result } = await executeRestore("success", { RESTORE_EVIDENCE_TARGET: "production" });
  try {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const evidence = JSON.parse(await readFile(path.join(evidenceRoot, "backupRestore.json"), "utf8"));
    assert.equal(evidence.target, "production");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm("/srv/storage", { recursive: true, force: true });
  }
});

test("restore rollback storage lama saat swap staging gagal", { skip: !canUseIsolatedStorageRoot }, async () => {
  const { root, calls, result } = await executeRestore("swap");
  try {
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /Swap storage baru gagal; safety backup akan dipulihkan/);
    assert.match(result.stderr, /memulihkan safety backup/);
    assert.equal(await readFile("/srv/storage/old.txt", "utf8"), "old storage\n");
    assert.match(await readFile(calls, "utf8"), /rollback\.sql/);
    assert.deepEqual((await readdir("/srv")).filter((name) => name.startsWith(".storage.previous.")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm("/srv/storage", { recursive: true, force: true });
  }
});

test("restore memulihkan DB dan storage serta tidak menulis evidence saat probe gagal", { skip: !canUseIsolatedStorageRoot }, async () => {
  const { root, calls, evidenceRoot, result } = await executeRestore("probe");
  try {
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /Probe database setelah restore gagal/);
    assert.match(result.stderr, /memulihkan safety backup/);
    assert.equal(await readFile("/srv/storage/old.txt", "utf8"), "old storage\n");
    assert.match(await readFile(calls, "utf8"), /rollback\.sql/);
    assert.deepEqual((await readdir(evidenceRoot)).filter((name) => name.startsWith("restore-") || name === "backupRestore.json"), []);
    assert.deepEqual((await readdir("/srv")).filter((name) => name.startsWith(".storage.previous.") || name.startsWith(".storage.failed.")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm("/srv/storage", { recursive: true, force: true });
  }
});

test("restore mewajibkan parent /srv sebagai mount terpisah", async () => {
  const source = await readFile(restoreScript, "utf8");
  assert.match(source, /\$5 == "\/srv"/);
  assert.match(source, /Parent storage \/srv wajib mount terpisah/);
});

test("restore fail-closed saat rollback database safety gagal", { skip: !canUseIsolatedStorageRoot }, async () => {
  const { root, evidenceRoot, result } = await executeRestore("rollback-fail");
  try {
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /KRITIS: rollback database dari safety backup gagal/);
    assert.equal(await readFile("/srv/storage/old.txt", "utf8"), "old storage\n");
    assert.deepEqual((await readdir(evidenceRoot)).filter((name) => name.startsWith("restore-") || name === "backupRestore.json"), []);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm("/srv/storage", { recursive: true, force: true });
  }
});
