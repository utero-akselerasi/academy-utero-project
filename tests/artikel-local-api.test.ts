import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendRequest: vi.fn(),
  resolveStorageUrl: vi.fn(),
}));

vi.mock("@/lib/backend/server", () => ({
  backendRequest: mocks.backendRequest,
  usesLocalBackend: () => true,
}));

vi.mock("@/lib/storage-urls", () => ({
  resolveStorageUrl: mocks.resolveStorageUrl,
}));

import { getArtikelArticle, getArtikelArticles } from "@/lib/artikel/api";

describe("artikel detail local backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveStorageUrl.mockImplementation(async (_bucket: string, value: string | null) =>
      value ? `/api/storage/article/${value}` : null);
  });

  it("membaca endpoint CMS lokal dan mempertahankan author", async () => {
    mocks.backendRequest.mockResolvedValue(new Response(JSON.stringify({
      article: {
        id: "11111111-1111-4111-8111-111111111111",
        site_id: "22222222-2222-4222-8222-222222222222",
        slug: "artikel-lokal",
        title: "Artikel Lokal",
        content: { text: "Isi" },
        cover_path: "covers/local.png",
        status: "published",
        published_at: "2026-10-15T00:00:00.000Z",
        created_at: "2026-10-15T00:00:00.000Z",
        updated_at: "2026-10-15T00:00:00.000Z",
        author_name: "Admin Academy",
      },
    }), { status: 200 }));

    const article = await getArtikelArticle("artikel lokal");

    expect(mocks.backendRequest).toHaveBeenCalledWith("/v1/cms/articles/artikel%20lokal");
    expect(mocks.resolveStorageUrl).toHaveBeenCalledWith("article", "covers/local.png");
    expect(article?.cover_path).toBe("/api/storage/article/covers/local.png");
    expect(article?.author_name).toBe("Admin Academy");
  });

  it("memetakan 404 lokal menjadi artikel tidak ditemukan", async () => {
    mocks.backendRequest.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(getArtikelArticle("tidak-ada")).resolves.toBeNull();
  });

  it("meneruskan status error backend lokal", async () => {
    mocks.backendRequest.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(getArtikelArticle("gagal")).rejects.toMatchObject({ status: 503 });
  });

  it("membaca daftar artikel dari CMS lokal tanpa memanggil API eksternal", async () => {
    const externalFetch = vi.spyOn(globalThis, "fetch");
    mocks.backendRequest.mockResolvedValue(new Response(JSON.stringify({
      articles: [{
        id: "11111111-1111-4111-8111-111111111111",
        slug: "daftar-lokal",
        title: "Daftar Lokal",
        cover_path: "covers/list.png",
        published_at: "2026-10-15T00:00:00.000Z",
      }],
      meta: { page: 2, limit: 5, total: 7 },
    }), { status: 200 }));

    const result = await getArtikelArticles({ category: "kategori-eksternal", page: 2, limit: 5 });

    expect(mocks.backendRequest).toHaveBeenCalledWith("/v1/cms/articles?page=2&limit=5");
    expect(mocks.resolveStorageUrl).toHaveBeenCalledWith("article", "covers/list.png");
    expect(externalFetch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ meta: { page: 2, limit: 5, total: 7 } });
    expect(result.articles[0].cover_path).toBe("/api/storage/article/covers/list.png");
  });
});
