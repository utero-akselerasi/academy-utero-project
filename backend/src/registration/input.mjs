const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;

export function validId(value) {
  return typeof value === "string" && uuid.test(value);
}

export function parseRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const fields = { fullName: [3, 150], phone: [8, 25], schoolName: [2, 150], major: [2, 120], motivation: [20, 3000], studentNumber: [0, 80], referralCode: [0, 80] };
  const value = {};
  for (const [key, [minimum, maximum]] of Object.entries(fields)) {
    if (typeof body[key] !== "string") return null;
    value[key] = body[key].trim();
    if (value[key].length < minimum || value[key].length > maximum) return null;
  }
  if (!validId(body.programId)) return null;
  for (const key of ["proposedStartDate", "proposedEndDate"]) {
    if (typeof body[key] !== "string" || !date.test(body[key]) || Number.isNaN(Date.parse(`${body[key]}T00:00:00Z`)) || new Date(`${body[key]}T00:00:00Z`).toISOString().slice(0, 10) !== body[key]) return null;
    value[key] = body[key];
  }
  if (value.proposedEndDate < value.proposedStartDate) return null;
  for (const key of ["cvPath", "portfolioPath"]) {
    if (key === "portfolioPath" && body[key] === null) { value[key] = null; continue; }
    if (typeof body[key] !== "string" || !/^[0-9a-f-]{36}\/applications\/(cv|portfolio)\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(body[key])) return null;
    value[key] = body[key];
  }
  if (!value.cvPath.includes("/cv/") || (value.portfolioPath && !value.portfolioPath.includes("/portfolio/"))) return null;
  return { ...value, programId: body.programId };
}
