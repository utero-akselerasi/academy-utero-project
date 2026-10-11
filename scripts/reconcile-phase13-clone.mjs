#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const [sourceDir, targetDatabase, outputPath] = process.argv.slice(2);
if (!sourceDir || !/^phase13_reconciled_[a-z0-9_]+$/.test(targetDatabase ?? "") || !outputPath) {
  throw new Error("Gunakan: node scripts/reconcile-phase13-clone.mjs <direktori-ekspor> <phase13_reconciled_nama> <file-sql-di-luar-repo>");
}
const repository = resolve(import.meta.dirname, "..");
const output = resolve(outputPath);
const outputRelative = relative(repository, output);
if (!outputRelative.startsWith("..") && !isAbsolute(outputRelative)) {
  throw new Error("File SQL berisi PII; simpan di luar repository.");
}
const sourceRelative = relative(resolve(sourceDir), output);
if (sourceRelative.startsWith("..") || isAbsolute(sourceRelative) || sourceRelative === "") {
  throw new Error("File SQL harus berada di direktori ekspor dengan ACL terlindungi.");
}

function load(side, table) {
  return readFileSync(join(sourceDir, `${side}-${table}.jsonl`), "utf8")
    .trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
function index(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const value = key(row);
    if (result.has(value)) throw new Error("Ekspor memiliki kunci duplikat.");
    result.set(value, row);
  }
  return result;
}
function quoteJson(value, label) {
  const payload = JSON.stringify(value);
  const delimiter = `$phase13_${label}$`;
  if (payload.includes(delimiter)) throw new Error("Delimiter SQL muncul dalam ekspor.");
  return `${delimiter}${payload}${delimiter}::json`;
}
function sameBusinessRow(left, right, ignored) {
  const normalize = (value) => typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)
    ? new Date(value).toISOString() : value;
  return Object.keys(left).every((field) => ignored.includes(field) ||
    JSON.stringify(normalize(left[field])) === JSON.stringify(normalize(right[field])));
}

const devAttendances = load("dev", "attendances");
const prodAttendances = load("prod", "attendances");
const devReports = load("dev", "daily_reports");
const prodReports = load("prod", "daily_reports");
const devAttachments = load("dev", "daily_report_attachments");
const prodAttachments = load("prod", "daily_report_attachments");
const devUsers = load("dev", "auth_users");
const prodUsers = load("prod", "auth_users");

const attendanceKey = (row) => `${row.intern_id}|${row.attendance_date}`;
const reportKey = (row) => `${row.intern_id}|${row.report_date}`;
const prodAttendanceKeys = index(prodAttendances, attendanceKey);
const prodReportKeys = index(prodReports, reportKey);
const prodAttendanceIds = index(prodAttendances, (row) => row.id);
const prodReportIds = index(prodReports, (row) => row.id);
const prodAttachmentIds = index(prodAttachments, (row) => row.id);
index(devAttendances, attendanceKey);
index(devReports, reportKey);
index(devAttachments, (row) => row.id);

const conflicts = devAttendances.filter((row) => {
  const existing = prodAttendanceKeys.get(attendanceKey(row));
  return existing && existing.id !== row.id;
});
for (const row of devAttendances) {
  const existing = prodAttendanceKeys.get(attendanceKey(row));
  if (existing && existing.id === row.id && !sameBusinessRow(row, existing, ["created_at", "updated_at"])) {
    throw new Error("Absensi ber-ID sama punya isi bisnis berbeda; perlu audit manual.");
  }
}
for (const row of devReports) {
  const existing = prodReportKeys.get(reportKey(row));
  if (existing && !sameBusinessRow(row, existing, ["created_at", "updated_at"])) {
    throw new Error("Laporan tanggal sama punya isi bisnis berbeda; perlu audit manual.");
  }
}
const attendances = devAttendances.filter((row) => !prodAttendanceKeys.has(attendanceKey(row)));
const reports = devReports.filter((row) => !prodReportKeys.has(reportKey(row)));
const newReportIds = new Set(reports.map((row) => row.id));
const attachments = devAttachments.filter((row) => newReportIds.has(row.report_id));
if (attendances.some((row) => prodAttendanceIds.has(row.id)) ||
    reports.some((row) => prodReportIds.has(row.id)) ||
    attachments.some((row) => prodAttachmentIds.has(row.id))) {
  throw new Error("ID yang akan ditambah sudah ada di production.");
}
const devExclusiveUsers = devUsers.filter((row) => !prodUsers.some((other) => other.id === row.id));
const conflictingUsers = devExclusiveUsers.filter((row) =>
  typeof row.email === "string" && prodUsers.some((other) =>
    typeof other.email === "string" && other.email.toLowerCase() === row.email.toLowerCase()));
if (conflicts.length !== 13 || attendances.length !== 148 || reports.length !== 126 ||
    attachments.length !== 117 || conflictingUsers.length !== 1 || devExclusiveUsers.length !== 1) {
  throw new Error("Ekspor berbeda dari audit; hentikan untuk audit ulang.");
}

const sql = [
  "\\set ON_ERROR_STOP on",
  "begin;",
  `do $guard$ begin if current_database() <> '${targetDatabase}' then raise exception 'Hanya clone ${targetDatabase} yang boleh menerima SQL ini'; end if;`,
  `if (select count(*) from utero_academy.attendances) <> ${prodAttendances.length} or (select count(*) from utero_academy.daily_reports) <> ${prodReports.length} or (select count(*) from utero_academy.daily_report_attachments) <> ${prodAttachments.length} or (select count(*) from auth.users) <> ${prodUsers.length} then raise exception 'Clone berubah sejak ekspor'; end if;`,
  "end $guard$;",
  `insert into utero_academy.attendances select * from json_populate_recordset(null::utero_academy.attendances, ${quoteJson(attendances, "attendance")});`,
  `insert into utero_academy.daily_reports select * from json_populate_recordset(null::utero_academy.daily_reports, ${quoteJson(reports, "report")});`,
  `insert into utero_academy.daily_report_attachments select * from json_populate_recordset(null::utero_academy.daily_report_attachments, ${quoteJson(attachments, "attachment")});`,
  `do $verify$ begin if (select count(*) from utero_academy.attendances) <> ${prodAttendances.length + attendances.length} or (select count(*) from utero_academy.daily_reports) <> ${prodReports.length + reports.length} or (select count(*) from utero_academy.daily_report_attachments) <> ${prodAttachments.length + attachments.length} or (select count(*) from auth.users) <> ${prodUsers.length} then raise exception 'Jumlah hasil rekonsiliasi tidak sesuai'; end if; end $verify$;`,
  "commit;",
].join("\n") + "\n";
writeFileSync(output, sql, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({
  targetDatabase,
  inserted: { attendances: attendances.length, dailyReports: reports.length, attachments: attachments.length },
  excluded: { attendanceConflicts: conflicts.length, authConflicts: conflictingUsers.length },
}));
