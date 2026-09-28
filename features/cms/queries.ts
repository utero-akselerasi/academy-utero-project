import { resolveStorageUrl, resolveStorageUrls } from "@/lib/storage-urls";
import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { type CmsSite, type Faq, type Testimonial, type Gallery, type Article } from "./types";

/**
 * Kolom storage CMS diselesaikan di lapisan query ini, bukan di titik render.
 *
 * Bucket `gallery` dan `article` **tetap publik** (lihat `PUBLIC_BUCKETS` di
 * `lib/storage-urls.ts`), jadi `resolveStorageUrl` mengembalikannya lewat
 * `getPublicUrl()` — tanpa token, tanpa TTL. Itu syarat mutlak di sini: keempat
 * kolom ini dirender di halaman publik yang di-cache (`revalidatePath("/")`),
 * dan menaruh signed URL ber-TTL di HTML ter-cache akan membuat gambar mati
 * begitu tokennya kedaluwarsa.
 *
 * Yang didapat dari konversi ini bukan kerahasiaan (isinya memang publik),
 * tapi: kolom DB berhenti menyimpan base URL yang bisa berubah, dan object
 * path-nya tersedia untuk `storage.remove()` kalau penghapusan objek yatim
 * nanti dikerjakan.
 */

export async function getDefaultSite() {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("cms_sites")
    .select("id, name, slug, domain")
    .eq("slug", "utero-academy")
    .maybeSingle();

  return { data: data as CmsSite | null, error };
}

export async function getCmsData(siteId: string) {
  const db = await createUteroAcademyServiceRoleClient();

  const [faqsRes, testimonialsRes, galleriesRes, articlesRes] = await Promise.all([
    db.from("faqs").select("*").eq("site_id", siteId).order("order_index", { ascending: true }),
    db.from("testimonials").select("*").eq("site_id", siteId).order("order_index", { ascending: true }),
    db.from("galleries").select("*").eq("site_id", siteId).order("order_index", { ascending: true }),
    db.from("articles").select("id, site_id, category_id, title, slug, excerpt, cover_path, status, published_at, created_at").eq("site_id", siteId).order("created_at", { ascending: false })
  ]);

  const testimonialRows = (testimonialsRes.data || []) as Testimonial[];
  const galleryRows = (galleriesRes.data || []) as Gallery[];
  const articleRows = (articlesRes.data || []) as Article[];

  const [testimonialPhotos, galleryImages, articleCovers] = await Promise.all([
    resolveStorageUrls("gallery", testimonialRows.map(t => t.photo_path)),
    resolveStorageUrls("gallery", galleryRows.map(g => g.image_path)),
    resolveStorageUrls("article", articleRows.map(a => a.cover_path)),
  ]);

  return {
    faqs: (faqsRes.data || []) as Faq[],
    testimonials: testimonialRows.map((t, i) => ({ ...t, photo_path: testimonialPhotos[i] })),
    galleries: galleryRows.map((g, i) => ({ ...g, image_path: galleryImages[i] })),
    articles: articleRows.map((a, i) => ({ ...a, cover_path: articleCovers[i] })),
    error: faqsRes.error || testimonialsRes.error || galleriesRes.error || articlesRes.error
  };
}

/**
 * Pengaturan landing page, dengan `hero_image_url` tambahan.
 *
 * Dua bentuk dikembalikan sekaligus, dan itu disengaja:
 *
 * - `hero_image_path` **tetap nilai mentah dari DB** (object path)
 * - `hero_image_url` adalah hasil resolusi, untuk dirender
 *
 * Alasannya: `LandingPageEditor` memuat nilai tersimpan ke state, lalu
 * mengirimkannya kembali apa adanya lewat input tersembunyi `heroImageUrl` ke
 * `updateLandingPageSettingsAction`. Kalau kueri ini menimpa
 * `hero_image_path` dengan URL hasil resolusi, setiap penyimpanan akan menulis
 * URL penuh kembali ke DB — konversi ke object path jadi selalu terbalik lagi
 * setiap kali admin menekan Simpan.
 *
 * Dengan memisahkan keduanya, form memegang path dan halaman publik memegang
 * URL, jadi jebakan itu tidak bisa terjadi.
 *
 * `skills`, `expertisers`, dan `partnerships` **tidak disentuh.** Ketiganya
 * JSONB bebas-isi: `icon_url`, `avatar`, dan `logo_url` di dalamnya bisa berupa
 * path aset lokal aplikasi (`/images/expert-dadik.jpg`), URL eksternal yang
 * ditempel admin, atau object path hasil `uploadCmsFileAction`.
 *
 * Yang melindungi ketiganya adalah keputusan **tidak memanggil** `toObjectPath`
 * atas mereka — bukan perilaku fungsi itu. Versi awal komentar ini mengklaim
 * `toObjectPath` mengembalikan `null` untuk dua bentuk pertama; itu salah, dan
 * `tests/storage-paths.test.ts` mengunci perilaku sebenarnya. `/images/expert-dadik.jpg`
 * bukan URL absolut, jadi ia jatuh ke cabang terakhir dan slash depannya dibuang:
 * hasilnya `images/expert-dadik.jpg` — object path yang akan ditandatangani dan
 * menghasilkan 404, bukan `null` yang jujur. Jadi mengonversinya akan **merusak
 * senyap** gambar yang sudah benar, dan perlindungannya harus tetap di sini.
 */
export async function getLandingPageSettings() {
  const db = await createUteroAcademyServiceRoleClient();
  const { data, error } = await db
    .from("landing_page_settings")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000002")
    .maybeSingle();

  if (!data) return { data, error };

  return {
    data: {
      ...data,
      hero_image_url: await resolveStorageUrl("gallery", data.hero_image_path),
    },
    error,
  };
}
