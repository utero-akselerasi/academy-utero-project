export type ArticleMedia = { url: string; altText: string; title?: string };
export type ArticleAddon = { id: string; type: string; title?: string; placement: "before_content" | "after_content"; sortOrder: number; config?: Record<string, unknown> | null };
