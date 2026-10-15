const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validId(value) {
  return typeof value === "string" && UUID.test(value);
}

function text(value, max, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) return null;
  return normalized;
}

export function parseCmsCreate(kind, body) {
  if (!validId(body?.siteId)) return null;
  if (kind === "faqs") {
    const question = text(body.question, 500, true);
    const answer = text(body.answer, 10_000, true);
    return question && answer ? { siteId: body.siteId, question, answer } : null;
  }
  if (kind === "testimonials") {
    const name = text(body.name, 200, true);
    const role = text(body.role, 200);
    const quote = text(body.quote, 5_000, true);
    const photoPath = text(body.photoPath, 1_024);
    return name && quote ? { siteId: body.siteId, name, role: role || null, quote, photoPath: photoPath || null } : null;
  }
  if (kind === "galleries") {
    const title = text(body.title, 300, true);
    const description = text(body.description, 5_000);
    const imagePath = text(body.imagePath, 1_024, true);
    return title && imagePath ? { siteId: body.siteId, title, description: description || null, imagePath } : null;
  }
  if (kind === "articles") {
    const title = text(body.title, 300, true);
    const excerpt = text(body.excerpt, 2_000);
    const content = text(body.content, 200_000, true);
    const coverPath = text(body.coverPath, 1_024);
    if (!title || !content) return null;
    const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 180);
    return slug ? { siteId: body.siteId, title, slug, excerpt: excerpt || null, content, coverPath: coverPath || null } : null;
  }
  return null;
}

export function parseLandingSettings(body) {
  const heroTitle = text(body?.heroTitle, 500, true);
  const heroDescription = text(body?.heroDescription, 5_000, true);
  if (!heroTitle || !heroDescription) return null;
  const arrays = ["skills", "expertisers", "partnerships"];
  if (arrays.some((key) => !Array.isArray(body?.[key]) || body[key].length > 100)) return null;
  return {
    heroTitle,
    heroDescription,
    heroImagePath: text(body.heroImagePath, 1_024) || null,
    skills: body.skills,
    expertisers: body.expertisers,
    partnerships: body.partnerships,
    aboutText: text(body.aboutText, 50_000) || null,
    contactEmail: text(body.contactEmail, 320) || null,
    contactPhone: text(body.contactPhone, 100) || null,
    contactAddress: text(body.contactAddress, 2_000) || null,
    termsContent: text(body.termsContent, 100_000) || null,
  };
}
