const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, min, max) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function calendarDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function parseApplication(value) {
  const fullName = text(value?.fullName, 3, 150);
  const email = text(value?.email, 3, 254)?.toLowerCase();
  const phone = text(value?.phone, 8, 25);
  const studentNumber = text(value?.studentNumber, 2, 50);
  const major = text(value?.major, 2, 150);
  const motivation = typeof value?.motivation === "string" && value.motivation.length <= 2000 ? value.motivation.trim() || null : null;
  const proposedStartDate = value?.proposedStartDate;
  const proposedEndDate = value?.proposedEndDate;
  if (!fullName || !email || !EMAIL.test(email) || !phone || !studentNumber || !major ||
      (value?.motivation != null && motivation == null && value.motivation !== "") ||
      !calendarDate(proposedStartDate) || !calendarDate(proposedEndDate) || proposedStartDate > proposedEndDate) return null;
  return { fullName, email, phone, studentNumber, major, motivation, proposedStartDate, proposedEndDate };
}

export function parseReportRange(query) {
  const from = query?.from;
  const to = query?.to;
  if (!calendarDate(from) || !calendarDate(to) || from > to) return null;
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  return Number.isFinite(days) && days <= 366 ? { from, to } : null;
}
