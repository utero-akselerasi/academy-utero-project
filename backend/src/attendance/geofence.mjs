export function distanceMeters(lat1, lon1, lat2, lon2) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resolveGeofence(settings) {
  if (!settings?.allow_geofencing) return { kind: "disabled" };
  const latitude = Number(settings.office_latitude);
  const longitude = Number(settings.office_longitude);
  const radiusMeters = Number(settings.radius_meters);
  if (settings.office_latitude === null || settings.office_longitude === null || settings.radius_meters === null ||
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(radiusMeters) || radiusMeters < 0) return { kind: "misconfigured" };
  return { kind: "active", latitude, longitude, radiusMeters };
}
