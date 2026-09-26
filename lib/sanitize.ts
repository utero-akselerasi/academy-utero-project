import sanitizeHtml from "sanitize-html";

/**
 * Bersihkan HTML kaya sebelum dirender.
 *
 * Konten artikel CMS dan materi LMS ditulis staf lewat editor Tiptap, lalu
 * dirender dengan dangerouslySetInnerHTML. Staf bukan super admin, dan
 * pembacanya publik (blog) atau seluruh peserta (materi), jadi satu akun staf
 * yang disalahgunakan bisa menitipkan <script> atau atribut on* yang berjalan
 * di sesi pembaca - termasuk sesi super admin yang membuka halaman yang sama.
 *
 * Whitelist ini mengikuti apa yang benar-benar bisa dihasilkan editor:
 * heading, penekanan, daftar, tabel, kutipan, kode, tautan, gambar.
 *
 * Hanya jalan di server (sanitize-html memakai API Node), jadi pemanggilnya
 * harus Server Component atau Server Action - jangan dipanggil dari komponen
 * "use client".
 */
export function sanitizeRichText(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "hr", "div", "span",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
      "a", "img", "figure", "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      col: ["span"],
      "*": ["class"],
    },
    // Hanya skema yang tidak bisa mengeksekusi kode. javascript: dan data:
    // sengaja tidak masuk daftar.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    // Tautan yang lolos tidak boleh memberi window.opener ke halaman tujuan.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
    },
    // style dibuang seluruhnya: nilai CSS bisa dipakai memuat sumber luar dan
    // menutupi elemen lain, dan editor tidak membutuhkannya.
    allowedStyles: {},
    disallowedTagsMode: "discard",
  });
}
