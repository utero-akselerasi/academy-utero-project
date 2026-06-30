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

const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(supabaseUrl, serviceKey).schema("utero_academy");

async function run() {
  console.log("Menjalankan query getMentorDailyReports...");
  
  // Ambil mentor assignments
  const { data: assignments, error: assError } = await db
    .from("mentor_assignments")
    .select("intern_id");

  if (assError) {
    console.error("Assignment Error:", assError);
    return;
  }

  if (!assignments || assignments.length === 0) {
    console.log("Tidak ada assignment.");
    return;
  }
  const internIds = assignments.map((a) => a.intern_id);

  // Ambil daily reports
  const { data, error } = await db
    .from("daily_reports")
    .select("id, intern_id, report_date, today_work, progress, blockers, tomorrow_plan, status, created_at, updated_at, daily_report_attachments(id, report_id, file_path, file_name, mime_type, size_bytes, created_at), intern_profiles(id, user_id, full_name)")
    .in("intern_id", internIds)
    .order("report_date", { ascending: false });

  console.log("Error dari query daily_reports:", error);
  console.log("Data count:", data ? data.length : 0);
}
run();
