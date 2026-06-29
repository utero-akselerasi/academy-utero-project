"use client";

import { reviewAttendanceAction } from "@/features/attendance/actions";
import { type AttendanceStatus } from "@/features/attendance/types";

type Props = {
  attendanceId: string;
  currentStatus: AttendanceStatus;
};

export function ReviewAttendanceForm({ attendanceId, currentStatus }: Props) {
  if (currentStatus === "valid") return null;

  return (
    <form action={reviewAttendanceAction} className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
      <input name="attendanceId" type="hidden" value={attendanceId} />
      <input className="form-input text-xs max-w-xs" name="note" placeholder="Catatan review..." />
      <button className="button-primary text-xs" name="status" type="submit" value="valid">Valid</button>
      <button className="button-secondary text-xs" name="status" type="submit" value="invalid">Invalid</button>
    </form>
  );
}
