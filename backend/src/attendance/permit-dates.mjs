import { validDate } from "./input.mjs";

export function permitDates(start, end, maxDays = 366) {
  if (!validDate(start) || !validDate(end) || start > end) return null;
  const dates = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const limit = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= limit) {
    if (dates.length >= maxDays) return null;
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
