import { sanitizeRichText } from "@/lib/sanitize";

const ADDON_PLACEHOLDER = /<p(?:\s[^>]*)?>\s*\[Add-on:[^\]]+\]\s*<\/p>/gi;
const LEADING_TITLE = /^\s*<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>\s*/i;

export function formatArticleContent(content: string, title: string) {
  return sanitizeRichText(content)
    .replace(ADDON_PLACEHOLDER, "")
    .replace(LEADING_TITLE, (heading) => (
      heading.replace(/<[^>]+>/g, "").trim() === sanitizeRichText(title).trim() ? "" : heading
    ))
    .trim();
}
