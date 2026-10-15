const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const validId = (value) => typeof value === "string" && UUID.test(value);

export function validDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

export function parseCoordinates(body) {
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  if (body?.latitude === null || body?.latitude === undefined || body?.longitude === null || body?.longitude === undefined) return null;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  const wifiSsid = typeof body?.wifiSsid === "string" ? body.wifiSsid.trim().slice(0, 255) || null : null;
  return { latitude, longitude, wifiSsid };
}

export function parseDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.toString("base64").replace(/=+$/, "") !== match[2].replace(/=+$/, "")) return null;
  return { mimeType: match[1].toLowerCase(), buffer };
}

export function parseUpload(body) {
  if (!body) return null;
  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) return null;
  return {
    ...parsed,
    fileName: typeof body.fileName === "string" ? body.fileName.slice(0, 255) : "upload",
  };
}
