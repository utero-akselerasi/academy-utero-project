import { type Attendance } from "./types";
import { localAttendanceList, localMyPermits, localTodayAttendance } from "./local";

export async function getInternAttendances(internProfileId: string) {
  return { data: await localAttendanceList(internProfileId) as Attendance[], error: null };
}

export async function getTodayAttendance(_internProfileId: string) {
  return localTodayAttendance();
}

export async function getMyPermits() {
  return localMyPermits();
}

export async function getMentorAttendances(_mentorProfileId: string) {
  return { data: await localAttendanceList(), error: null };
}

export async function getAllAttendances() {
  return { data: await localAttendanceList(), error: null };
}
