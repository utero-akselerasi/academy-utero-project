import { describe, expect, it } from "vitest";
import { isImagePath, isPdfPath, isPublicBucket, toObjectPath } from "@/lib/storage-urls";

/**
 * `toObjectPath` adalah aturan pemangkasan yang menentukan isi backfill B0.3b —
 * langkah **berisiko tertinggi** di seluruh remediasi, karena ia menulis ulang
 * baris produksi dan tidak bisa dibatalkan dengan grant ulang seperti `0031`.
 *
 * Kenapa fungsi ini yang dites lebih dulu, bukan guard atau policy: kesalahannya
 * **tidak melempar error**. Sebuah pola yang salah mengembalikan `null`, dan
 * `null` di aplikasi ini tampil sebagai "gambar tidak ada" — bukan sebagai
 * kegagalan. Jadi satu-satunya cara tahu aturannya benar adalah menuliskan
 * bentuk nilai yang benar-benar ada di kolom produksi dan mengunci hasilnya.
 *
 * Yang **tidak** diklaim di sini: bahwa SQL backfill memangkas dengan cara yang
 * sama. Test ini dipakai sebagai spesifikasi saat menulisnya — setiap baris di
 * bawah adalah satu kasus yang SQL-nya harus hasilkan sama.
 *
 * SQL-nya sekarang ada: `supabase/manual/B0.3b_backfill_storage_paths.sql`, dan
 * bagian (3)-nya memuat 17 kasus yang mencerminkan berkas ini. Tapi keduanya
 * **tidak terikat secara mekanis** — tidak ada yang memaksa keduanya sinkron,
 * jadi perubahan di sini harus diikutkan ke sana dengan tangan.
 *
 * Satu penyimpangan disengaja dan tercatat di kedua tempat: untuk masukan
 * campuran seperti `a%20b%.pdf`, `safeDecode()` JS menyerah total dan
 * mengembalikan `a%20b%.pdf`, sedangkan SQL-nya mendekode per escape dan
 * menghasilkan `a b%.pdf` — yang merupakan object path yang benar. SQL-nya lebih
 * benar di sini, bukan sebaliknya.
 */

const HTTPS_BASE = "https://supabase.carubra.com/storage/v1/object/public/avatars/";

describe("toObjectPath — bentuk nilai yang ada di produksi", () => {
  it("meneruskan object path apa adanya", () => {
    // Bentuk tujuan: apa yang `buildStoragePath()` hasilkan.
    expect(toObjectPath("uid/attendance_in/foto.jpg", "avatars")).toBe("uid/attendance_in/foto.jpg");
  });

  it("memangkas URL publik lama", () => {
    expect(toObjectPath(HTTPS_BASE + "uid/attendance_in/foto.jpg", "avatars")).toBe(
      "uid/attendance_in/foto.jpg",
    );
  });

  it("memangkas URL publik yang ditulis dengan base http://", () => {
    // Contoh env repo memakai `http://` sedangkan produksi `https://`. Inilah
    // alasan pencocokan memakai pola `/object/public/<bucket>/` dan BUKAN
    // perbandingan dengan NEXT_PUBLIC_SUPABASE_URL: mencocokkan base akan gagal
    // senyap untuk baris yang ditulis ketika base-nya masih berbeda.
    expect(
      toObjectPath(
        "http://supabase.carubra.com/storage/v1/object/public/avatars/uid/foto.jpg",
        "avatars",
      ),
    ).toBe("uid/foto.jpg");
  });

  it("memangkas signed URL beserta query token-nya", () => {
    // Nilai bertoken bisa tersimpan tak sengaja lewat round-trip form
    // (`hero_image_path` di LandingPageEditor). Token yang ikut tersimpan akan
    // kedaluwarsa, jadi baris tercemar harus tetap bisa dipulihkan.
    expect(
      toObjectPath(
        "https://supabase.carubra.com/storage/v1/object/sign/avatars/uid/foto.jpg?token=eyJhbGci.abc",
        "avatars",
      ),
    ).toBe("uid/foto.jpg");
  });

  it("mengembalikan null untuk URL yang bucket-nya tidak cocok", () => {
    // Penting untuk backfill: `UPDATE` per kolom menyebut satu bucket. Kalau
    // pemanggil menyebut bucket yang salah, menandatanganinya dengan bucket
    // keliru menghasilkan 404 yang membingungkan — lebih baik null.
    expect(toObjectPath(HTTPS_BASE + "uid/foto.jpg", "gallery")).toBeNull();
  });

  it("mengembalikan null untuk URL eksternal", () => {
    // `cms.carubra.com` menyajikan artikel dari instance CMS terpisah, dan
    // `app/(public)/blog/[slug]/page.tsx` hanya meresolusi cabang DB-nya.
    expect(toObjectPath("https://cms.carubra.com/uploads/a.jpg", "article")).toBeNull();
    expect(toObjectPath("https://drive.google.com/file/d/abc/view", "daily-report")).toBeNull();
  });

  it("membuang slash depan supaya path tidak jadi ganda", () => {
    // Supabase memperlakukan `//uid/x.jpg` sebagai path berbeda dari `uid/x.jpg`.
    expect(toObjectPath("/uid/foto.jpg", "avatars")).toBe("uid/foto.jpg");
    expect(toObjectPath("///uid/foto.jpg", "avatars")).toBe("uid/foto.jpg");
  });

  it("mendekode escape persen pada nama berkas", () => {
    // Nama unggahan bisa mengandung spasi; URL-nya menyimpannya sebagai `%20`,
    // sedangkan object path yang dipakai Supabase adalah bentuk terdekode.
    expect(toObjectPath(HTTPS_BASE + "uid/surat%20sakit.pdf", "avatars")).toBe(
      "uid/surat sakit.pdf",
    );
  });

  it("tidak melempar untuk escape persen yang tidak valid", () => {
    // `decodeURIComponent("100%.pdf")` melempar URIError. Satu nama berkas aneh
    // tidak boleh menggagalkan seluruh backfill maupun seluruh render halaman.
    expect(toObjectPath(HTTPS_BASE + "uid/100%.pdf", "avatars")).toBe("uid/100%.pdf");
  });

  it("mengembalikan null untuk kosong, spasi, null, dan undefined", () => {
    // Kolomnya nullable di setiap tabel, dan string kosong benar-benar ada.
    for (const value of [null, undefined, "", "   "]) {
      expect(toObjectPath(value, "avatars")).toBeNull();
    }
  });

  it("idempoten: hasilnya tidak berubah kalau diproses dua kali", () => {
    // Ini yang membuat backfill aman diulang, dan membuat `resolveStorageUrl`
    // boleh dipanggil atas baris lama MAUPUN baris yang sudah dimigrasi tanpa
    // perlu tahu yang mana.
    const once = toObjectPath(HTTPS_BASE + "uid/foto.jpg", "avatars");
    expect(toObjectPath(once, "avatars")).toBe(once);
  });

  /**
   * Perilaku ini **tidak diinginkan tapi nyata**, jadi dikunci di sini alih-alih
   * dibiarkan jadi kejutan.
   *
   * Komentar di `features/cms/queries.ts:83` menyatakan `skills`/`expertisers`/
   * `partnerships` aman dari konversi karena `toObjectPath` "mengembalikan null"
   * untuk path aset lokal seperti `/images/expert-dadik.jpg`. **Itu salah.**
   * Nilai itu bukan URL absolut, jadi ia jatuh ke cabang terakhir dan slash
   * depannya dibuang — hasilnya `images/expert-dadik.jpg`, sebuah object path
   * yang akan ditandatangani dan menghasilkan 404, bukan `null` yang jujur.
   *
   * Yang benar-benar melindungi ketiga field itu adalah keputusan untuk **tidak
   * memanggil** `toObjectPath` atas mereka sama sekali (`getLandingPageSettings`
   * hanya meresolusi `hero_image_path`) — bukan perilaku fungsi ini. Test ini
   * ada supaya perlindungan itu tidak pernah dianggap sudah ditangani di
   * lapisan yang salah.
   */
  it("TIDAK menolak path aset lokal — perlindungannya ada di pemanggil", () => {
    expect(toObjectPath("/images/expert-dadik.jpg", "gallery")).toBe("images/expert-dadik.jpg");
  });
});

describe("isPublicBucket — harus cocok dengan policy 0032a", () => {
  /**
   * Daftar ini kembar dengan predikat `public_buckets_read` di
   * `0032a_storage_limits_and_policies.sql`. Kalau keduanya menyimpang, akibatnya
   * satu dari dua hal, dan keduanya buruk: bucket yang kode anggap publik tapi
   * DB privat membuat gambar mati, dan sebaliknya membuat objek sensitif terbaca
   * tanpa tanda tangan.
   */
  it("hanya gallery, article, mentor, school-logo yang publik", () => {
    for (const bucket of ["gallery", "article", "mentor", "school-logo"] as const) {
      expect(isPublicBucket(bucket), `${bucket} harus publik`).toBe(true);
    }
  });

  it("avatars privat — ia keranjang campur berisi CV, selfie, dan surat sakit", () => {
    // Justru bucket inilah yang terbukti bisa diambil tanpa header auth sama
    // sekali (HTTP 200, 48654 bytes). Ia tidak boleh pernah kembali jadi publik
    // hanya karena avatar profil ada di dalamnya.
    expect(isPublicBucket("avatars")).toBe(false);
  });

  it("daily-report, task, certificate, learning privat", () => {
    for (const bucket of ["daily-report", "task", "certificate", "learning"] as const) {
      expect(isPublicBucket(bucket), `${bucket} harus privat`).toBe(false);
    }
  });
});

describe("isPdfPath / isImagePath — dinilai dari path, bukan dari URL", () => {
  /**
   * Inilah cacat yang sebenarnya diperbaiki: titik render dulu memakai
   * `url.endsWith(".pdf")`, yang **selalu false** begitu URL-nya bertanda tangan
   * karena signed URL berakhir `?token=...`. Akibatnya setiap PDF dirender
   * sebagai gambar rusak.
   */
  it("mengenali PDF pada signed URL yang berakhir dengan token", () => {
    const signed =
      "https://supabase.carubra.com/storage/v1/object/sign/avatars/uid/surat.pdf?token=eyJ.abc";
    // Bukti regresi lamanya, ditulis eksplisit supaya tidak bisa kembali.
    expect(signed.endsWith(".pdf")).toBe(false);
    expect(isPdfPath(signed, "avatars")).toBe(true);
  });

  it("mengenali PDF pada object path polos dan tidak peduli huruf besar-kecil", () => {
    expect(isPdfPath("uid/surat.pdf", "avatars")).toBe(true);
    expect(isPdfPath("uid/SURAT.PDF", "avatars")).toBe(true);
  });

  it("mengenali gambar, dan memisahkannya dari PDF", () => {
    for (const ext of ["jpg", "jpeg", "png", "gif", "webp"]) {
      expect(isImagePath(`uid/foto.${ext}`, "avatars"), ext).toBe(true);
    }
    expect(isImagePath("uid/surat.pdf", "avatars")).toBe(false);
    expect(isPdfPath("uid/foto.jpg", "avatars")).toBe(false);
  });

  it("false — bukan true — untuk nilai kosong dan bucket yang salah", () => {
    // Titik render memilih `<a href>` vs `<ImagePreview>` dari hasil ini, jadi
    // default-nya harus bentuk yang tidak mencoba memuat gambar.
    expect(isPdfPath(null, "avatars")).toBe(false);
    expect(isImagePath(null, "avatars")).toBe(false);
    expect(isImagePath("uid/tanpa-ekstensi", "avatars")).toBe(false);
    expect(isPdfPath(HTTPS_BASE + "uid/surat.pdf", "gallery")).toBe(false);
  });
});
