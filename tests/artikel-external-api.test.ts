import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/backend/server", () => ({ backendRequest: vi.fn(), usesLocalBackend: () => true }));
vi.mock("@/lib/storage-urls", () => ({ resolveStorageUrl: vi.fn() }));

import { artikelApiSelected, getArtikelArticle, getArtikelArticles } from "@/lib/artikel/api";

describe("artikel external API", () => {
  beforeEach(() => {
    process.env.ARTIKEL_API_URL = "https://cms.example.test/api/v1";
    process.env.ARTIKEL_API_KEY = "ak_live_test";
    process.env.ARTIKEL_DEFAULT_CATEGORY = "news";
    process.env.ARTIKEL_SOURCE = "external";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ARTIKEL_API_URL;
    delete process.env.ARTIKEL_API_KEY;
    delete process.env.ARTIKEL_DEFAULT_CATEGORY;
    delete process.env.ARTIKEL_SOURCE;
  });

  it("mengirim key melalui header dan memakai signed image URL", async () => {
    expect(artikelApiSelected()).toBe(true);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [{ slug: "berita", title: "Berita", featured_image_url: "https://storage.example.test/signed" }],
      meta: { page: 1, limit: 10, total: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await getArtikelArticles();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cms.example.test/api/v1/articles?category=news&page=1&limit=10",
      expect.objectContaining({ headers: { "x-artikel-key": "ak_live_test", Accept: "application/json" } }),
    );
    expect(result.articles[0].cover_path).toBe("https://storage.example.test/signed");
  });

  it("meneruskan Retry-After dari rate limit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: { code: "RATE_LIMITED", message: "Terlalu banyak request" },
    }), { status: 429, headers: { "content-type": "application/json", "retry-after": "17" } }));
    await expect(getArtikelArticle("berita")).rejects.toMatchObject({ status: 429, retryAfterSeconds: 17 });
  });

  it("menolak bentuk data daftar yang tidak sesuai kontrak", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: {} }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    await expect(getArtikelArticles()).rejects.toMatchObject({ status: 502 });
  });

  it("gagal jelas saat sumber eksternal dipilih tetapi key kosong", async () => {
    delete process.env.ARTIKEL_API_KEY;
    delete process.env.ARTIKEL_PUBLIC_READ_API_KEY;
    expect(artikelApiSelected()).toBe(true);
    await expect(getArtikelArticles()).rejects.toThrow("ARTIKEL_API_KEY belum dikonfigurasi.");
  });
});
