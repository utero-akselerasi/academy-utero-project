export const BUCKETS = Object.freeze({
  "academy-private": { public: false, maxBytes: 20 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  "selection-answers": { public: false, maxBytes: 20 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
  avatars: { public: false, maxBytes: 5 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp"] },
  "daily-report": { public: false, maxBytes: 20 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
  task: { public: false, maxBytes: 20 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"] },
  certificate: { public: false, maxBytes: 10 * 1024 * 1024, mime: ["application/pdf"] },
  learning: { public: false, maxBytes: 100 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"] },
  gallery: { public: true, maxBytes: 10 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp"] },
  article: { public: true, maxBytes: 10 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp"] },
  mentor: { public: true, maxBytes: 5 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp"] },
  "school-logo": { public: true, maxBytes: 5 * 1024 * 1024, mime: ["image/jpeg", "image/png", "image/webp"] },
});

export function getBucket(name) {
  return BUCKETS[name] || null;
}
