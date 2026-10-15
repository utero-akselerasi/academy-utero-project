import { parseUpload, validDate, validId } from "../attendance/input.mjs";

export { validId };

export function parseReport(body) {
  const reportDate = body?.reportDate;
  const todayWork = typeof body?.todayWork === "string" ? body.todayWork.trim() : "";
  if (!validDate(reportDate) || todayWork.length < 10 || todayWork.length > 20_000) return null;
  const optional = (value, max = 20_000) => typeof value === "string" ? value.trim().slice(0, max) || null : null;
  const reportId = body?.reportId ? String(body.reportId) : null;
  if (reportId && !validId(reportId)) return null;
  const attachments = Array.isArray(body?.attachments) ? body.attachments.map(parseUpload) : [];
  if (attachments.some((attachment) => !attachment) || attachments.length > 10) return null;
  const driveLink = optional(body?.googleDriveLink, 2048);
  if (driveLink && !isAllowedDriveLink(driveLink)) return null;
  return {
    reportId, reportDate, todayWork, progress: optional(body?.progress), blockers: optional(body?.blockers),
    tomorrowPlan: optional(body?.tomorrowPlan), attachments, driveLink,
  };
}

export function isAllowedDriveLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["drive.google.com", "docs.google.com"].includes(url.hostname);
  } catch { return false; }
}
