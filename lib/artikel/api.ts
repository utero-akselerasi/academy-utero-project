import type { Article } from "@/features/cms/types";

type ArtikelCategory = { name: string; slug: string } | null;
export type ArtikelArticle = Article & { content: unknown; featured_image_url: string | null; og_image_url: string | null; category: ArtikelCategory; article_tags: unknown[]; addons: unknown[] };
export type ArtikelPagination = { page: number; limit: number; total: number };
type ArtikelResponse<T> = { data: T; meta?: ArtikelPagination };

export class ArtikelApiError extends Error {
  constructor(public readonly status: number, message = `Artikel API gagal (${status}).`) {
    super(message);
  }
}

const baseUrl = () => (process.env.ARTIKEL_API_URL || process.env.ARTIKEL_PUBLIC_READ_API_URL || "https://cms.carubra.com").replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
const apiKey = () => process.env.ARTIKEL_API_KEY || process.env.ARTIKEL_PUBLIC_READ_API_KEY;

function apiErrorMessage(body: unknown, status: number) {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const payload = body as Record<string, unknown>;
    const error = payload.error;
    if (typeof error === "string" && error.trim()) return error;
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  }
  return `Artikel API gagal (${status}).`;
}

async function artikelFetch<T>(path: string) {
  const key = apiKey();
  if (!key) throw new Error("ARTIKEL_API_KEY belum dikonfigurasi.");
  const response = await fetch(`${baseUrl()}${path}`, { headers: { "x-artikel-key": key, Accept: "application/json" }, next: { revalidate: 60 } });
  const body = await response.json().catch(() => null) as T | null;
  if (!response.ok) throw new ArtikelApiError(response.status, apiErrorMessage(body, response.status));
  if (!body || typeof body !== "object" || !("data" in body)) throw new ArtikelApiError(502);
  return body as T;
}

function mapArticle(article: Partial<ArtikelArticle>): ArtikelArticle {
  const timestamp = article.published_at || new Date().toISOString();
  return { id: article.id || article.slug || crypto.randomUUID(), site_id: article.site_id || "artikel-cms", category_id: article.category_id || null, title: article.title || "Tanpa judul", slug: article.slug || "", excerpt: article.excerpt || null, content: article.content || "", cover_path: article.cover_path || article.featured_image_url || null, featured_image_url: article.featured_image_url || article.cover_path || null, og_image_url: article.og_image_url || null, category: article.category || null, article_tags: article.article_tags || [], addons: article.addons || [], status: "published", published_at: article.published_at || null, created_at: article.created_at || timestamp, updated_at: article.updated_at || timestamp };
}

export function artikelApiConfigured() { return Boolean(apiKey()); }

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && value! > 0 ? value! : fallback;
}

export async function getArtikelArticles(options: { category?: string; page?: number; limit?: number } = {}) {
  const categoryValue = options.category || process.env.ARTIKEL_DEFAULT_CATEGORY;
  if (!categoryValue) throw new Error("Kategori artikel belum dikonfigurasi.");
  const categories = [...new Set(categoryValue.split(",").map((category) => category.trim()).filter(Boolean))];
  if (categories.length === 0) throw new Error("Kategori artikel belum dikonfigurasi.");
  const page = positiveInteger(options.page, 1);
  const limit = Math.min(50, positiveInteger(options.limit, 10));

  if (categories.length === 1) {
    const query = new URLSearchParams({ category: categories[0], page: String(page), limit: String(limit) });
    const response = await artikelFetch<ArtikelResponse<Partial<ArtikelArticle>[]>>(`/api/v1/articles?${query}`);
    return { articles: (response.data || []).map(mapArticle), meta: response.meta || { page, limit, total: 0 } };
  }

  const responses = await Promise.all(categories.map(async (category) => {
    const firstQuery = new URLSearchParams({ category, page: "1", limit: "50" });
    const first = await artikelFetch<ArtikelResponse<Partial<ArtikelArticle>[]>>(`/api/v1/articles?${firstQuery}`);
    const pageCount = Math.ceil((first.meta?.total || first.data.length) / 50);
    if (pageCount <= 1) return first.data;
    const remaining = await Promise.all(Array.from({ length: pageCount - 1 }, async (_, index) => {
      const query = new URLSearchParams({ category, page: String(index + 2), limit: "50" });
      return artikelFetch<ArtikelResponse<Partial<ArtikelArticle>[]>>(`/api/v1/articles?${query}`);
    }));
    return first.data.concat(...remaining.map((response) => response.data));
  }));

  const articles = [...new Map(responses.flat().map(mapArticle).map((article) => [article.slug, article])).values()]
    .sort((left, right) => new Date(right.published_at || right.created_at).getTime() - new Date(left.published_at || left.created_at).getTime());
  const offset = (page - 1) * limit;
  return { articles: articles.slice(offset, offset + limit), meta: { page, limit, total: articles.length } };
}

export async function getArtikelArticle(slug: string) {
  try {
    const response = await artikelFetch<ArtikelResponse<Partial<ArtikelArticle>>>(`/api/v1/articles/${encodeURIComponent(slug)}`);
    return response.data ? mapArticle(response.data) : null;
  } catch (error) {
    if (error instanceof ArtikelApiError && error.status === 404) return null;
    throw error;
  }
}

export async function publishArtikelArticle(payload: Record<string, unknown>) {
  const key = process.env.ARTIKEL_AUTOMATION_API_KEY;
  if (!key) throw new Error("ARTIKEL_AUTOMATION_API_KEY belum dikonfigurasi.");
  const response = await fetch("https://supabase.carubra.com/functions/v1/automation-api", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key }, body: JSON.stringify(payload), cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Automation API gagal (${response.status}).`);
  return body;
}
