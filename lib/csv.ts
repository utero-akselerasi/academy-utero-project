export type CsvCell = string | number | null | undefined;

const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Netralkan formula injection: spreadsheet mengeksekusi sel yang dimulai dengan
 * =, +, -, @, tab, atau CR. Prefiks tanda kutip tunggal membuatnya tetap teks.
 */
function neutralizeFormula(value: string) {
  if (value.length === 0) return value;
  return FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger)) ? `'${value}` : value;
}

export function escapeCsvCell(value: CsvCell) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return `"${neutralizeFormula(stringValue).replace(/"/g, '""')}"`;
}

export function buildCsv(rows: CsvCell[][]) {
  return "﻿" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

/**
 * Buang path traversal, kutip, CR/LF, dan karakter kontrol dari nama file agar
 * tidak bisa menyuntik header tambahan ke Content-Disposition.
 */
export function sanitizeCsvFilename(value: string, fallback: string) {
  const base = value.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"';]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const safe = cleaned.length > 0 && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
  return safe.toLowerCase().endsWith(".csv") ? safe : `${safe}.csv`;
}

export function csvContentDisposition(filename: string) {
  const safe = sanitizeCsvFilename(filename, "export.csv");
  const asciiFallback = safe.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export function csvResponseHeaders(filename: string) {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": csvContentDisposition(filename),
    "Cache-Control": "no-store",
  };
}
