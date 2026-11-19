export type AttendanceCoordinates = {
  latitude: number;
  longitude: number;
};

export function parseAttendanceCoordinates(latitude: unknown, longitude: unknown): AttendanceCoordinates | null {
  if (
    latitude === null || latitude === undefined || latitude === "" ||
    longitude === null || longitude === undefined || longitude === ""
  ) return null;

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (
    !Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude) ||
    parsedLatitude < -90 || parsedLatitude > 90 ||
    parsedLongitude < -180 || parsedLongitude > 180
  ) return null;

  return { latitude: parsedLatitude, longitude: parsedLongitude };
}
