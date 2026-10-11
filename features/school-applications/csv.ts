import { schoolApplicationSchema, type SchoolApplicationInput } from "./schemas";
import type { BulkImportRowResult } from "./types";

export const CSV_HEADERS = [
  "full_name",
  "email",
  "phone",
  "student_number",
  "major",
  "motivation",
  "proposed_start_date",
  "proposed_end_date",
] as const;

export type ParsedCsvApplication = {
  row: number;
  data: SchoolApplicationInput | null;
  result: BulkImportRowResult;
};

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"' && (quoted || value === "")) {
      quoted = !quoted;
    } else if (char === '"') {
      throw new Error("CSV memiliki kutip pada posisi tidak valid.");
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error("CSV memiliki kutip yang tidak ditutup.");
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function parseSchoolApplicationsCsv(input: string): ParsedCsvApplication[] {
  const rows = parseCsvRows(input.replace(/^\uFEFF/, ""));
  if (rows.length === 0) throw new Error("CSV kosong.");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const missing = CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) throw new Error(`Kolom CSV belum lengkap: ${missing.join(", ")}.`);

  const seenEmails = new Set<string>();
  const seenStudentNumbers = new Set<string>();

  return rows.slice(1).map((cells, index) => {
    const value = (header: (typeof CSV_HEADERS)[number]) => cells[headers.indexOf(header)]?.trim() ?? "";
    const raw = {
      fullName: value("full_name"),
      email: value("email"),
      phone: value("phone"),
      studentNumber: value("student_number"),
      major: value("major"),
      motivation: value("motivation"),
      proposedStartDate: value("proposed_start_date"),
      proposedEndDate: value("proposed_end_date"),
    };
    const parsed = schoolApplicationSchema.safeParse(raw);
    const errors = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    const email = raw.email.toLowerCase();
    const studentNumber = raw.studentNumber.toLowerCase();

    if (seenEmails.has(email)) errors.push("Email duplikat di dalam CSV.");
    if (seenStudentNumbers.has(studentNumber)) errors.push("NIS/NIM duplikat di dalam CSV.");
    if (email) seenEmails.add(email);
    if (studentNumber) seenStudentNumbers.add(studentNumber);

    return {
      row: index + 2,
      data: parsed.success && errors.length === 0 ? parsed.data : null,
      result: {
        row: index + 2,
        fullName: raw.fullName,
        email: raw.email,
        studentNumber: raw.studentNumber,
        status: "invalid",
        errors,
      },
    };
  });
}
