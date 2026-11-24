const DAY_MS = 86_400_000;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseCalendarDay(value: string | null | undefined): number | null {
  if (value == null) return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return Number.NaN;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31) return Number.NaN;

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return Number.NaN;
  return Math.floor(timestamp / DAY_MS);
}

function targetBetween(start: number, end: number): { workdays: number; hours: number } {
  let workdays = 0;
  for (let day = start; day <= end; day += 1) {
    if (new Date(day * DAY_MS).getUTCDay() !== 0) workdays += 1;
  }
  return { workdays, hours: workdays * 8 };
}

function monthBounds(month: string): { start: number; end: number } | null {
  const match = MONTH_PATTERN.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (year < 100 || monthNumber < 1 || monthNumber > 12) return null;
  const start = Math.floor(Date.UTC(year, monthNumber - 1, 1) / DAY_MS);
  const end = Math.floor(Date.UTC(year, monthNumber, 0) / DAY_MS);
  return { start, end };
}

function calculate(month: string, startDate?: string | null, endDate?: string | null, asOfDate?: string): { workdays: number; hours: number } {
  const bounds = typeof month === "string" ? monthBounds(month) : null;
  if (!bounds) return { workdays: 0, hours: 0 };

  const activeStart = parseCalendarDay(startDate);
  const activeEnd = parseCalendarDay(endDate);
  const asOf = asOfDate === undefined ? bounds.end : parseCalendarDay(asOfDate);
  if (Number.isNaN(activeStart) || Number.isNaN(activeEnd) || Number.isNaN(asOf)) return { workdays: 0, hours: 0 };

  const start = Math.max(bounds.start, activeStart ?? bounds.start);
  const end = Math.min(bounds.end, activeEnd ?? bounds.end, asOf ?? bounds.end);
  return end < start ? { workdays: 0, hours: 0 } : targetBetween(start, end);
}

/** Count Monday–Saturday target hours within month and optional active dates. */
export function getMonthlyAttendanceTarget(month: string, startDate?: string | null, endDate?: string | null): { workdays: number; hours: number } {
  return calculate(month, startDate, endDate);
}

/** Count target through as-of date, inclusive, clamped to month and active dates. */
export function getElapsedMonthlyAttendanceTarget(month: string, asOfDate: string, startDate?: string | null, endDate?: string | null): { workdays: number; hours: number } {
  return calculate(month, startDate, endDate, asOfDate);
}

