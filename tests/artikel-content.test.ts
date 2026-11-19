import { describe, expect, it } from "vitest";
import { formatArticleContent } from "@/lib/artikel/content";

describe("formatArticleContent", () => {
  it("menghapus judul ganda dan placeholder add-on", () => {
    const result = formatArticleContent(
      "<h1>Judul artikel</h1><p>[Add-on: advertising malang]</p><p>Paragraf utama.</p><p>[Add-on: image slider]</p>",
      "Judul artikel",
    );

    expect(result).toBe("<p>Paragraf utama.</p>");
  });

  it("tetap menyaring HTML berbahaya", () => {
    const result = formatArticleContent('<h1>Judul</h1><p onclick="alert(1)">Aman</p><script>alert(1)</script>', "Judul");

    expect(result).toBe("<p>Aman</p>");
  });

  it("mempertahankan heading isi dan daftar", () => {
    const result = formatArticleContent("<h2>Layanan</h2><ul><li><p>Neon box</p></li></ul>", "Judul artikel");

    expect(result).toBe("<h2>Layanan</h2><ul><li><p>Neon box</p></li></ul>");
  });

  it("tidak menghapus heading yang berbeda dari judul halaman", () => {
    expect(formatArticleContent("<h1>Pengantar</h1><p>Isi</p>", "Judul artikel"))
      .toBe("<h1>Pengantar</h1><p>Isi</p>");
  });
});
