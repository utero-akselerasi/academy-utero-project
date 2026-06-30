const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

if (fs.existsSync(".env")) {
  const content = fs.readFileSync(".env", "utf8");
  content.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      process.env[key] = val;
    }
  });
}

async function run() {
  const sql = fs.readFileSync(path.join("supabase", "migrations", "0004_plane_tasks_features.sql"), "utf8");
  
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:54322/postgres";
  console.log("Connecting to database:", connectionString.replace(/:[^:@]+@/, ":***@"));
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Koneksi sukses! Mengeksekusi SQL...");
    await client.query(sql);
    console.log("Migrasi SQL sukses diterapkan di database!");
  } catch (err) {
    console.error("Gagal menjalankan migrasi database:", err);
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}
run();
