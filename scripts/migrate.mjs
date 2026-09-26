#!/usr/bin/env node
/**
 * Runner migrasi berurutan yang gagal-keras.
 *
 * Pengganti apply-migration.js, yang tidak bisa dipakai menerapkan migrasi baru
 * karena tiga cacat: nama berkas di-hardcode ke 0004, connection string punya
 * fallback ke localhost (env yang hilang menarget database yang salah secara
 * senyap), dan error hanya di-console.error tanpa rethrow sehingga migrasi gagal
 * keluar dengan exit code 0.
 *
 * Perilaku di sini kebalikannya:
 * - tanpa fallback connection string sama sekali
 * - satu transaksi per berkas, berhenti total pada kegagalan pertama
 * - checksum tiap berkas yang sudah diterapkan diperiksa ulang setiap run, jadi
 *   migrasi yang disunting setelah diterapkan langsung terdeteksi
 * - default --dry-run: menerapkan ke DB harus diminta eksplisit
 *
 * Pemakaian:
 *   node scripts/migrate.mjs --status
 *   node scripts/migrate.mjs --dry-run
 *   node scripts/migrate.mjs --apply
 *   node scripts/migrate.mjs --baseline 0027
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");

// Angka ber-nol-depan membuat urutan leksikal sama dengan numerik. Sufiks huruf
// opsional dipakai untuk memecah migrasi besar (0031a, 0031b) supaya kegagalan
// terlokalisasi, dan tetap ikut urutan yang sama.
const MIGRATION_FILE_PATTERN = /^(\d{4}[a-z]?)_.+\.sql$/;

// Beberapa pernyataan tidak boleh jalan di dalam transaksi (mis. CREATE INDEX
// CONCURRENTLY). Berkas yang butuh itu menandai dirinya sendiri di baris awal.
const NO_TRANSACTION_MARKER = "-- migrate:no-transaction";

/**
 * Muat .env baris per baris, tanpa dependensi luar. Variabel yang sudah ada di
 * environment tidak ditimpa, supaya nilai dari shell atau CI selalu menang.
 * Nilainya tidak pernah dicetak.
 */
function readDotEnvInto(target) {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (key in target) continue;
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/s, "$1")
      .replace(/^'(.*)'$/s, "$1");
    target[key] = value;
  }
}

/**
 * Ambil connection string. TIDAK ADA fallback: env yang hilang harus berhenti,
 * bukan diam-diam menarget database lain.
 */
function requireConnectionString() {
  const value = process.env.DATABASE_URL;
  if (!value || !value.trim()) {
    fail(
      "DATABASE_URL tidak diset.\n" +
        "Runner ini sengaja tidak punya nilai default — connection string yang " +
        "salah berarti migrasi diterapkan ke database yang salah.\n" +
        "Set DATABASE_URL di .env atau di environment, lalu jalankan ulang.",
    );
  }
  return value.trim();
}

/** Sembunyikan kata sandi sebelum connection string masuk log. */
function redact(connectionString) {
  return connectionString.replace(/\/\/([^:/@]+):[^@]*@/, "//$1:***@");
}

function fail(message) {
  console.error(`\nGAGAL: ${message}\n`);
  process.exit(1);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Baca dan urutkan berkas migrasi. Dua berkas dengan versi sama adalah kesalahan
 * yang harus menghentikan run: urutannya jadi tidak tentu.
 */
function discoverMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fail(`Direktori migrasi tidak ada: ${MIGRATIONS_DIR}`);
  }

  const entries = [];
  const seenVersions = new Map();

  for (const filename of fs.readdirSync(MIGRATIONS_DIR).sort()) {
    const match = MIGRATION_FILE_PATTERN.exec(filename);
    if (!match) continue;

    const version = match[1];
    if (seenVersions.has(version)) {
      fail(
        `Dua berkas memakai versi "${version}":\n` +
          `  ${seenVersions.get(version)}\n  ${filename}\n` +
          "Urutan penerapan jadi tidak tentu. Beri nomor berbeda.",
      );
    }
    seenVersions.set(version, filename);

    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const bytes = fs.readFileSync(fullPath);
    entries.push({
      version,
      filename,
      fullPath,
      sql: bytes.toString("utf8"),
      checksum: sha256(bytes),
    });
  }

  if (entries.length === 0) {
    fail(`Tidak ada berkas migrasi yang cocok pola di ${MIGRATIONS_DIR}`);
  }

  entries.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  return entries;
}

async function ensureTrackingTable(client) {
  await client.query("begin");
  try {
    await client.query("create schema if not exists utero_academy");
    await client.query(`
      create table if not exists utero_academy.schema_migrations (
        version     text primary key,
        filename    text not null,
        checksum    text not null,
        applied_at  timestamptz not null default now(),
        applied_by  text not null default current_user,
        duration_ms integer
      )
    `);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function readApplied(client) {
  const { rows } = await client.query(
    "select version, filename, checksum, applied_at from utero_academy.schema_migrations order by version",
  );
  return new Map(rows.map((row) => [row.version, row]));
}

/**
 * Bandingkan checksum tiap versi yang sudah diterapkan. Ini mekanisme yang
 * membuat penyimpangan terdeteksi ke depan: menyunting migrasi yang sudah
 * diterapkan tidak bisa lolos diam-diam.
 */
function assertChecksums(migrations, applied) {
  const problems = [];

  for (const migration of migrations) {
    const record = applied.get(migration.version);
    if (!record) continue;
    if (record.checksum !== migration.checksum) {
      problems.push(
        `  ${migration.filename} sudah diterapkan ${record.applied_at.toISOString()} ` +
          "tapi isinya sudah berubah sejak itu",
      );
    }
  }

  const known = new Set(migrations.map((m) => m.version));
  for (const [version, record] of applied) {
    if (!known.has(version)) {
      problems.push(`  versi ${version} (${record.filename}) tercatat diterapkan tapi berkasnya tidak ada`);
    }
  }

  if (problems.length > 0) {
    fail(
      "Checksum tidak cocok:\n" +
        problems.join("\n") +
        "\n\nMigrasi yang sudah diterapkan tidak boleh disunting di tempat. " +
        "Tulis migrasi baru yang memperbaiki keadaannya.",
    );
  }
}

/**
 * Celah nomor DI BAWAH versi tertinggi yang sudah diterapkan berarti ada migrasi
 * yang dilewati — keadaan DB tidak bisa lagi disimpulkan dari nomor tertinggi.
 */
function assertNoBackfilledGaps(migrations, applied) {
  if (applied.size === 0) return;

  const highestApplied = [...applied.keys()].sort().at(-1);
  const skipped = migrations.filter((m) => m.version < highestApplied && !applied.has(m.version));

  if (skipped.length > 0) {
    fail(
      "Ada migrasi yang belum diterapkan padahal nomornya di bawah versi tertinggi " +
        `yang sudah diterapkan (${highestApplied}):\n` +
        skipped.map((m) => `  ${m.filename}`).join("\n") +
        "\n\nMenerapkannya sekarang berarti urutannya tidak sesuai nomor. Periksa " +
        "keadaan database sebelum lanjut.",
    );
  }
}

async function applyOne(client, migration) {
  const useTransaction = !migration.sql.slice(0, 200).includes(NO_TRANSACTION_MARKER);
  const startedAt = process.hrtime.bigint();

  if (useTransaction) await client.query("begin");

  try {
    // Dikirim sebagai satu batch multi-statement, TIDAK dipecah pada titik koma:
    // blok `do $$ ... $$` dan definisi fungsi akan tercacah kalau dipecah.
    await client.query(migration.sql);

    const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);

    await client.query(
      `insert into utero_academy.schema_migrations (version, filename, checksum, duration_ms)
       values ($1, $2, $3, $4)`,
      [migration.version, migration.filename, migration.checksum, durationMs],
    );

    if (useTransaction) await client.query("commit");
    return durationMs;
  } catch (error) {
    if (useTransaction) {
      try {
        await client.query("rollback");
      } catch {
        // Koneksi bisa sudah tidak bisa dipakai; error aslinya yang penting.
      }
    }
    throw error;
  }
}

function printPlan(migrations, applied) {
  console.log(`\nDitemukan ${migrations.length} berkas migrasi.\n`);
  for (const migration of migrations) {
    const record = applied.get(migration.version);
    const mark = record ? "diterapkan" : "TERTUNDA  ";
    const suffix = record ? ` (${record.applied_at.toISOString()})` : ` (sha256 ${migration.checksum.slice(0, 12)})`;
    console.log(`  [${mark}] ${migration.filename}${suffix}`);
  }
}

function parseArgs(argv) {
  const options = { mode: "dry-run", baselineTo: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--status") options.mode = "status";
    else if (arg === "--dry-run") options.mode = "dry-run";
    else if (arg === "--apply") options.mode = "apply";
    else if (arg === "--baseline") {
      options.mode = "baseline";
      options.baselineTo = argv[i + 1];
      i += 1;
      if (!options.baselineTo || !/^\d{4}[a-z]?$/.test(options.baselineTo)) {
        fail("--baseline butuh nomor versi, contoh: --baseline 0027");
      }
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "",
          "  node scripts/migrate.mjs --status         daftar diterapkan vs tertunda",
          "  node scripts/migrate.mjs --dry-run       sama, tanpa menyentuh DB (default)",
          "  node scripts/migrate.mjs --apply         terapkan yang tertunda, berurutan",
          "  node scripts/migrate.mjs --baseline 0027 tandai 0001-0027 sudah diterapkan",
          "                                           TANPA menjalankannya",
          "",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      fail(`Argumen tidak dikenal: ${arg}`);
    }
  }

  return options;
}

async function main() {
  readDotEnvInto(process.env);

  const options = parseArgs(process.argv.slice(2));
  const migrations = discoverMigrations();

  if (options.mode === "dry-run") {
    console.log("\nMode dry-run: tidak ada koneksi ke database, tidak ada yang diterapkan.");
    console.log(`\nDitemukan ${migrations.length} berkas migrasi, urutan penerapan:\n`);
    for (const migration of migrations) {
      console.log(`  ${migration.filename}  sha256 ${migration.checksum.slice(0, 12)}`);
    }
    console.log("\nJalankan dengan --status untuk membandingkan dengan keadaan database.\n");
    return;
  }

  const connectionString = requireConnectionString();
  console.log(`\nKoneksi: ${redact(connectionString)}`);

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await ensureTrackingTable(client);
    const applied = await readApplied(client);

    assertChecksums(migrations, applied);

    const pending = migrations.filter((m) => !applied.has(m.version));

    if (options.mode === "status") {
      printPlan(migrations, applied);
      console.log(`\n${applied.size} diterapkan, ${pending.length} tertunda.\n`);
      process.exit(pending.length > 0 ? 1 : 0);
    }

    if (options.mode === "baseline") {
      const target = migrations.filter((m) => m.version <= options.baselineTo && !applied.has(m.version));
      if (target.length === 0) {
        console.log(`\nTidak ada yang perlu ditandai sampai ${options.baselineTo}.\n`);
        return;
      }
      console.log(`\nMenandai ${target.length} migrasi sebagai sudah diterapkan TANPA menjalankannya:\n`);
      await client.query("begin");
      try {
        for (const migration of target) {
          await client.query(
            `insert into utero_academy.schema_migrations (version, filename, checksum, duration_ms)
             values ($1, $2, $3, null)`,
            [migration.version, migration.filename, migration.checksum],
          );
          console.log(`  ditandai ${migration.filename}`);
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
      console.log("\nSelesai. Tidak ada SQL migrasi yang dieksekusi.\n");
      return;
    }

    // options.mode === "apply"
    assertNoBackfilledGaps(migrations, applied);

    if (pending.length === 0) {
      console.log("\nTidak ada migrasi tertunda.\n");
      return;
    }

    console.log(`\nMenerapkan ${pending.length} migrasi, berurutan:\n`);

    for (const migration of pending) {
      process.stdout.write(`  ${migration.filename} ... `);
      try {
        const durationMs = await applyOne(client, migration);
        console.log(`ok (${durationMs} ms)`);
      } catch (error) {
        console.log("GAGAL");
        console.error(`\nBerkas: ${migration.filename}`);
        console.error(`Error PostgreSQL: ${error.message}`);
        if (error.code) console.error(`Kode: ${error.code}`);
        if (error.position) console.error(`Posisi: ${error.position}`);
        console.error(
          "\nTransaksi sudah di-rollback. Migrasi berikutnya TIDAK dijalankan.\n" +
            "Perbaiki berkas ini lalu jalankan ulang.\n",
        );
        process.exit(1);
      }
    }

    console.log(`\n${pending.length} migrasi diterapkan.\n`);
  } finally {
    try {
      await client.end();
    } catch {
      // Menutup koneksi yang sudah mati bukan kegagalan.
    }
  }
}

main().catch((error) => {
  console.error("\nGAGAL:", error.message);
  if (error.code) console.error("Kode:", error.code);
  process.exit(1);
});
