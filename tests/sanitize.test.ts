import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "@/lib/sanitize";

/**
 * Kenapa fungsi ini yang dites, dan kenapa ia yang paling langsung berbahaya:
 *
 * Hasilnya dirender dengan `dangerouslySetInnerHTML`. Masukannya ditulis staf
 * lewat editor Tiptap. Pembacanya publik (blog) atau seluruh peserta (materi LMS)
 * — **termasuk super admin yang membuka halaman yang sama**. Jadi satu akun staf
 * yang disalahgunakan bisa menitipkan skrip yang berjalan di sesi super admin.
 *
 * Whitelist adalah pendekatan yang benar, tapi whitelist yang salah **tidak
 * melempar apa pun**: HTML-nya terlihat wajar dan skripnya berjalan. Hanya test
 * yang bisa menangkapnya.
 *
 * Test di bawah dibagi dua: yang **harus dibuang** (setiap vektor eksekusi), dan
 * yang **harus bertahan** (setiap bentuk yang bisa dihasilkan Tiptap). Bagian
 * kedua sama pentingnya — whitelist yang terlalu ketat membuat staf kehilangan
 * isi tulisannya tanpa peringatan, dan itu juga kegagalan senyap.
 */

describe("vektor eksekusi skrip dibuang", () => {
  it("membuang <script> beserta isinya, bukan cuma tagnya", () => {
    const hasil = sanitizeRichText('<p>Hai</p><script>alert(1)</script>');
    expect(hasil).not.toContain("script");
    expect(hasil).not.toContain("alert");
    expect(hasil).toContain("<p>Hai</p>");
  });

  it("membuang SEMUA atribut on* — ini kelas terbesarnya", () => {
    for (const html of [
      '<img src="https://a.test/x.png" onerror="alert(1)">',
      '<p onclick="alert(1)">x</p>',
      '<div onmouseover="alert(1)">x</div>',
      '<a href="https://a.test" onfocus="alert(1)">x</a>',
      '<p onload="alert(1)">x</p>',
      '<p ONERROR="alert(1)">x</p>',
      '<p onerror =alert(1)>x</p>',
    ]) {
      const hasil = sanitizeRichText(html);
      expect(hasil.toLowerCase(), html).not.toMatch(/\son[a-z]+/);
      expect(hasil, html).not.toContain("alert");
    }
  });

  it("membuang javascript: dari href — skema yang mengeksekusi kode", () => {
    for (const jahat of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'java\tscript:alert(1)',
      ' javascript:alert(1)',
      'jAvAsCrIpT:alert(1)',
    ]) {
      const hasil = sanitizeRichText(`<a href="${jahat}">klik</a>`);
      expect(hasil.toLowerCase(), jahat).not.toContain("javascript:");
      expect(hasil, jahat).not.toContain("alert");
    }
  });

  it("membuang data: dari href dan src — data:text/html mengeksekusi skrip", () => {
    const html = '<a href="data:text/html,<script>alert(1)</script>">x</a>';
    expect(sanitizeRichText(html)).not.toContain("data:");

    const gambar = '<img src="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=">';
    expect(sanitizeRichText(gambar)).not.toContain("data:");
  });

  it("membuang <iframe>, <object>, <embed>, <form>", () => {
    for (const html of [
      '<iframe src="https://penyerang.test"></iframe>',
      '<object data="x.swf"></object>',
      '<embed src="x.swf">',
      '<form action="https://penyerang.test"><input name="a"></form>',
      '<base href="https://penyerang.test/">',
      '<meta http-equiv="refresh" content="0;url=https://penyerang.test">',
      '<link rel="stylesheet" href="https://penyerang.test/a.css">',
    ]) {
      const hasil = sanitizeRichText(html);
      expect(hasil, html).not.toMatch(/<(iframe|object|embed|form|base|meta|link|input)/i);
    }
  });

  it("membuang <svg> — ia bisa memuat <script> dan animasi yang mengeksekusi", () => {
    const hasil = sanitizeRichText('<svg><script>alert(1)</script></svg>');
    expect(hasil).not.toContain("svg");
    expect(hasil).not.toContain("alert");
  });

  it("membuang <style> dan atribut style — CSS bisa memuat sumber luar", () => {
    // `allowedStyles: {}` menutup atributnya; `style` tidak ada di allowedTags.
    const hasil = sanitizeRichText(
      '<style>body{background:url(https://penyerang.test/lacak)}</style><p style="position:fixed;top:0;left:0;width:100vw;height:100vh">x</p>',
    );
    expect(hasil).not.toContain("<style");
    expect(hasil).not.toContain("style=");
    expect(hasil).not.toContain("penyerang.test");
  });

  it("atribut style yang menutupi halaman dibuang — clickjacking tanpa skrip", () => {
    // Tanpa skrip pun, satu <div> berposisi fixed seukuran layar bisa menutupi UI
    // dan menangkap klik. Karena itu `style` dibuang seluruhnya, bukan disaring.
    const hasil = sanitizeRichText('<div style="position:fixed;z-index:9999">x</div>');
    expect(hasil).not.toContain("position");
  });

  it("membuang atribut di luar whitelist per tag", () => {
    // `srcset`, `formaction`, `id` semuanya bisa dipakai menyalahgunakan halaman.
    const hasil = sanitizeRichText(
      '<img src="https://a.test/x.png" srcset="https://penyerang.test/y.png" id="target">',
    );
    expect(hasil).not.toContain("srcset");
    expect(hasil).not.toContain("id=");
    expect(hasil).toContain("https://a.test/x.png");
  });

  it("membuang <img src> berskema selain http/https", () => {
    // `allowedSchemesByTag.img` lebih ketat dari daftar global — `mailto:` sah
    // untuk <a> tapi tidak masuk akal untuk <img>.
    expect(sanitizeRichText('<img src="mailto:a@b.test">')).not.toContain("mailto:");
    expect(sanitizeRichText('<img src="file:///etc/passwd">')).not.toContain("file:");
  });

  it("HTML rusak dan tag bersarang tidak meloloskan skrip", () => {
    // Penyerang mengandalkan parser yang memulihkan bentuk rusak jadi bentuk yang
    // bisa dieksekusi. `sanitize-html` mengurai penuh, bukan mencocokkan regex.
    //
    // Yang diasersi adalah **tak ada tag yang bisa dieksekusi**, bukan tak ada
    // string "alert(1)". Bedanya penting: `<scr<script>ipt>alert(1)</script>`
    // menghasilkan `ipt&gt;alert(1)` — teks ter-escape yang tampil apa adanya di
    // halaman dan tidak dieksekusi apa pun. Menuntut string itu hilang akan
    // menuntut sanitizer **membuang teks**, yang bukan tugasnya.
    for (const html of [
      "<scr<script>ipt>alert(1)</script>",
      "<<SCRIPT>alert(1);//<</SCRIPT>",
      "<p><script>alert(1)</p></script>",
      "<img src=x onerror=alert(1)//>",
      '<a href="javascript&#58;alert(1)">x</a>',
      '<a href="&#106;avascript:alert(1)">x</a>',
    ]) {
      const hasil = sanitizeRichText(html);
      expect(hasil.toLowerCase(), html).not.toContain("<script");
      expect(hasil.toLowerCase(), html).not.toMatch(/\son[a-z]+\s*=/);
      expect(hasil.toLowerCase(), html).not.toContain("javascript:");
      // Setiap `<` yang tersisa harus sudah ter-escape jadi `&lt;`.
      expect(hasil, html).not.toMatch(/<(?!\/?(p|a|img|br)\b)/);
    }
  });

  it("komentar HTML bersyarat tidak meloloskan apa pun", () => {
    expect(sanitizeRichText("<!--[if IE]><script>alert(1)</script><![endif]-->")).not.toContain(
      "alert",
    );
  });
});

describe("tautan yang lolos tidak boleh memberi window.opener", () => {
  it("menambahkan rel noopener noreferrer nofollow", () => {
    // Tanpa `noopener`, halaman tujuan bisa mengubah `window.opener.location` dan
    // mengarahkan tab aplikasi ke halaman login palsu.
    const hasil = sanitizeRichText('<a href="https://a.test" target="_blank">x</a>');
    expect(hasil).toContain('rel="noopener noreferrer nofollow"');
  });

  it("menimpa rel yang ditulis penulis, bukan menggabungkannya", () => {
    // `simpleTransform` default-nya menimpa. Itu yang diinginkan: `rel` pilihan
    // penulis tidak boleh melemahkan `noopener`.
    const hasil = sanitizeRichText('<a href="https://a.test" rel="opener">x</a>');
    expect(hasil).toContain('rel="noopener noreferrer nofollow"');
    expect(hasil).not.toMatch(/rel="[^"]*\bopener\b[^"]*"/);
  });

  it("berlaku juga untuk tautan tanpa target", () => {
    expect(sanitizeRichText('<a href="https://a.test">x</a>')).toContain("noopener");
  });
});

describe("skema yang diizinkan", () => {
  it("http, https, dan mailto bertahan", () => {
    expect(sanitizeRichText('<a href="https://a.test/x">x</a>')).toContain("https://a.test/x");
    expect(sanitizeRichText('<a href="http://a.test/x">x</a>')).toContain("http://a.test/x");
    expect(sanitizeRichText('<a href="mailto:a@b.test">x</a>')).toContain("mailto:a@b.test");
  });

  it("tautan relatif bertahan — editor bisa menaut ke halaman internal", () => {
    expect(sanitizeRichText('<a href="/dashboard/lms">x</a>')).toContain('href="/dashboard/lms"');
  });

  it("skema lain dibuang", () => {
    for (const skema of ["ftp:", "tel:", "vbscript:", "file:"]) {
      const hasil = sanitizeRichText(`<a href="${skema}x">x</a>`);
      expect(hasil, skema).not.toContain(skema);
    }
  });
});

describe("isi yang sah harus bertahan — whitelist terlalu ketat juga kegagalan senyap", () => {
  it("heading, penekanan, dan daftar bertahan", () => {
    const html =
      "<h2>Judul</h2><p><strong>tebal</strong> <em>miring</em> <u>garis</u> <s>coret</s></p><ul><li>satu</li></ul><ol><li>dua</li></ol>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("tabel bertahan lengkap dengan colspan dan scope", () => {
    const html =
      '<table><thead><tr><th scope="col" colspan="2">A</th></tr></thead><tbody><tr><td rowspan="2">B</td></tr></tbody></table>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("blockquote, pre, code, dan figure bertahan", () => {
    // `sanitize-html` memancarkan tag kosong bergaya XHTML (`<img … />`). Bentuknya
    // berbeda dari masukan tapi setara secara semantik di HTML5, jadi yang
    // diasersi adalah tag dan atributnya, bukan kesamaan string persis.
    const hasil = sanitizeRichText(
      '<blockquote><p>kutipan</p></blockquote><pre><code>const a = 1;</code></pre><figure><img src="https://a.test/x.png" alt="x"><figcaption>ket</figcaption></figure>',
    );
    expect(hasil).toContain("<blockquote><p>kutipan</p></blockquote>");
    expect(hasil).toContain("<pre><code>const a = 1;</code></pre>");
    expect(hasil).toContain("<figure>");
    expect(hasil).toContain('<img src="https://a.test/x.png" alt="x" />');
    expect(hasil).toContain("<figcaption>ket</figcaption>");
  });

  it("atribut class bertahan di semua tag — Tiptap memakainya untuk penyelarasan", () => {
    // Kalau `class` dibuang, seluruh gaya isi artikel hilang tanpa peringatan.
    expect(sanitizeRichText('<p class="text-center">x</p>')).toContain('class="text-center"');
  });

  it("gambar dengan alt, width, height bertahan", () => {
    const hasil = sanitizeRichText(
      '<img src="https://a.test/x.png" alt="Diagram" width="600" height="400">',
    );
    expect(hasil).toBe(
      '<img src="https://a.test/x.png" alt="Diagram" width="600" height="400" />',
    );
  });

  it("entitas HTML dan karakter non-ASCII tidak rusak", () => {
    expect(sanitizeRichText("<p>a &amp; b &lt; c</p>")).toBe("<p>a &amp; b &lt; c</p>");
    expect(sanitizeRichText("<p>Peserta magang — selesai ✓</p>")).toContain("—");
  });

  it("teks yang MIRIP tag dibiarkan sebagai teks yang sudah di-escape", () => {
    // Artikel tentang pemrograman akan memuat contoh kode. Ia harus tampil, bukan
    // hilang.
    const hasil = sanitizeRichText("<p>Pakai &lt;script&gt; untuk memuat JS</p>");
    expect(hasil).toContain("&lt;script&gt;");
  });
});

describe("masukan tepi", () => {
  it("string kosong dan teks biasa tidak melempar", () => {
    expect(sanitizeRichText("")).toBe("");
    expect(sanitizeRichText("teks biasa")).toBe("teks biasa");
  });

  it("idempoten — menyanitasi dua kali memberi hasil sama", () => {
    // Penting karena isi bisa disimpan lalu disanitasi ulang saat render. Kalau
    // tidak idempoten, artikel akan berubah sendiri tiap kali disimpan ulang.
    const kotor = '<p onclick="x">a</p><script>b</script><a href="https://a.test">c</a>';
    const sekali = sanitizeRichText(kotor);
    expect(sanitizeRichText(sekali)).toBe(sekali);
  });

  it("isi yang sangat bersarang tidak melempar", () => {
    const bersarang = "<div>".repeat(200) + "x" + "</div>".repeat(200);
    expect(() => sanitizeRichText(bersarang)).not.toThrow();
  });
});
