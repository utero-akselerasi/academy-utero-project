import { jakartaMinutesOfDay, parseWallClockMinutes } from "@/lib/time";

export function getLateMinutes(checkInAt: string, deadline: string | number | null | undefined): number {
  const actual = jakartaMinutesOfDay(new Date(checkInAt));
  const deadlineMinutes = typeof deadline === "number" && Number.isFinite(deadline)
    ? deadline
    : parseWallClockMinutes(deadline) ?? 9 * 60;
  return Number.isFinite(actual) ? Math.max(0, actual - deadlineMinutes) : 0;
}

export function getExpectedCheckOut(checkInAt: string): Date | null {
  const checkIn = new Date(checkInAt);
  return Number.isFinite(checkIn.getTime()) ? new Date(checkIn.getTime() + 8 * 60 * 60 * 1000) : null;
}
