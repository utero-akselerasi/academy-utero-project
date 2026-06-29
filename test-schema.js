const fs = require("fs");
const path = require("path");

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

const { Client } = require("pg");

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:54322/postgres" // default port supabase local jika ada
  });
  
  try {
    // Kita juga bisa menggunakan service role client supabase untuk mendapatkan list column jika pg connectionString tidak diset
    const { createClient } = require("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const db = createClient(supabaseUrl, serviceKey).schema("utero_academy");
    
    console.log("=== COLUMNS IN daily_reports ===");
    // Ambil baris pertama dari daily_reports untuk melihat fieldnya
    const { data: reportSample, error: err1 } = await db.from("daily_reports").select("*").limit(1);
    if (err1) {
      console.error("Error daily_reports:", err1);
    } else {
      console.log("Columns:", reportSample.length > 0 ? Object.keys(reportSample[0]) : "No records found in daily_reports");
    }

    console.log("=== COLUMNS IN daily_report_attachments ===");
    const { data: attSample, error: err2 } = await db.from("daily_report_attachments").select("*").limit(1);
    if (err2) {
      console.error("Error daily_report_attachments:", err2);
    } else {
      console.log("Columns:", attSample.length > 0 ? Object.keys(attSample[0]) : "No records found in daily_report_attachments");
    }
  } catch (err) {
    console.error(err);
  }
}
run();
