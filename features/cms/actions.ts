"use server";

import { requireAdmin, requireUser } from "@/features/auth/guards";
import { createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { UploadValidationError, buildStoragePath, validateUpload } from "@/lib/uploads";
import { revalidatePath } from "next/cache";

// Guard terpusat: cek role lewat semua baris user_roles (guard lama pakai
// maybeSingle() sehingga user multi-role gagal, dan super_admin ikut ditolak).
// Server Action wajib punya guard sendiri karena bisa dipanggil langsung lewat
// action ID tanpa melewati layout/page.
const requireAdminUser = requireAdmin;

// === FAQ ACTIONS ===
export async function createFaqAction(formData: FormData) {
  await requireAdminUser();
  const siteId = formData.get("siteId") as string;
  const question = formData.get("question") as string;
  const answer = formData.get("answer") as string;

  if (!siteId || !question || !answer) throw new Error("Semua field FAQ wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();

  const { data: maxOrder } = await db
    .from("faqs")
    .select("order_index")
    .eq("site_id", siteId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("faqs").insert({
    site_id: siteId,
    question,
    answer,
    order_index: nextOrder,
    status: "published"
  });

  if (error) {
    console.error("Gagal buat FAQ:", error);
    throw new Error("Gagal menyimpan FAQ.");
  }

  revalidatePath("/dashboard/admin/cms");
}

export async function deleteFaqAction(formData: FormData) {
  await requireAdminUser();
  const faqId = formData.get("faqId") as string;
  if (!faqId) throw new Error("FAQ ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("faqs").delete().eq("id", faqId);

  if (error) {
    console.error("Gagal hapus FAQ:", error);
    throw new Error("Gagal menghapus FAQ.");
  }

  revalidatePath("/dashboard/admin/cms");
}

// === TESTIMONIAL ACTIONS ===
export async function createTestimonialAction(formData: FormData) {
  await requireAdminUser();
  const siteId = formData.get("siteId") as string;
  const name = formData.get("name") as string;
  const role = formData.get("role") as string;
  const quote = formData.get("quote") as string;
  const file = formData.get("photo") as File;

  if (!siteId || !name || !quote) throw new Error("Nama dan quote testimoni wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();
  let photoPath: string | null = null;

  if (file && file.size > 0) {
    // Ekstensi & MIME tetap divalidasi dari isi berkas meski bucket "gallery"
    // publik: validasinya menahan berkas yang menyamar sebagai gambar, terpisah
    // dari soal siapa yang boleh membacanya.
    let photo;
    try {
      photo = await validateUpload(file, ["image"]);
    } catch (error) {
      if (error instanceof UploadValidationError) throw new Error(error.message);
      console.error("Gagal memvalidasi foto testimoni:", error);
      throw new Error("Foto testimoni tidak dapat diproses.");
    }

    const supabase = createSupabaseServiceRoleClient();
    const filePath = buildStoragePath("testimonial", photo.ext);

    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(filePath, photo.buffer, {
        contentType: photo.contentType,
        upsert: false
      });

    if (uploadError) {
      console.error("Gagal upload foto testimoni:", uploadError);
      throw new Error("Gagal mengunggah foto testimoni.");
    }

    // Object path, bukan URL publik. Diselesaikan di `getCmsData()`.
    photoPath = filePath;
  }

  const { data: maxOrder } = await db
    .from("testimonials")
    .select("order_index")
    .eq("site_id", siteId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("testimonials").insert({
    site_id: siteId,
    name,
    role: role || null,
    quote,
    photo_path: photoPath,
    order_index: nextOrder,
    status: "published"
  });

  if (error) {
    console.error("Gagal buat testimonial:", error);
    throw new Error("Gagal menyimpan testimoni.");
  }

  revalidatePath("/dashboard/admin/cms");
}

export async function deleteTestimonialAction(formData: FormData) {
  await requireAdminUser();
  const testId = formData.get("testId") as string;
  if (!testId) throw new Error("Testimonial ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("testimonials").delete().eq("id", testId);

  if (error) {
    console.error("Gagal hapus testimonial:", error);
    throw new Error("Gagal menghapus testimoni.");
  }

  revalidatePath("/dashboard/admin/cms");
}

// === GALLERY ACTIONS ===
export async function createGalleryAction(formData: FormData) {
  await requireAdminUser();
  const siteId = formData.get("siteId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const file = formData.get("image") as File;

  if (!siteId || !title || !file || file.size === 0) {
    throw new Error("Judul dan file gambar wajib diunggah.");
  }

  // Validasi isi berkas tetap berlaku meski bucket "gallery" publik.
  let image;
  try {
    image = await validateUpload(file, ["image"]);
  } catch (error) {
    if (error instanceof UploadValidationError) throw new Error(error.message);
    console.error("Gagal memvalidasi gambar galeri:", error);
    throw new Error("Gambar galeri tidak dapat diproses.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const filePath = buildStoragePath("gallery", image.ext);

  const { error: uploadError } = await supabase.storage
    .from("gallery")
    .upload(filePath, image.buffer, {
      contentType: image.contentType,
      upsert: false
    });

  if (uploadError) {
    console.error("Gagal upload gambar galeri:", uploadError);
    throw new Error("Gagal mengunggah file gambar.");
  }

  const db = await createUteroAcademyServiceRoleClient();

  const { data: maxOrder } = await db
    .from("galleries")
    .select("order_index")
    .eq("site_id", siteId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("galleries").insert({
    site_id: siteId,
    title,
    description: description || null,
    // Object path, bukan URL publik. Diselesaikan di `getCmsData()`.
    image_path: filePath,
    order_index: nextOrder,
    status: "published"
  });

  if (error) {
    console.error("Gagal simpan galeri DB:", error);
    throw new Error("Gagal menyimpan data galeri.");
  }

  revalidatePath("/dashboard/admin/cms");
}

export async function deleteGalleryAction(formData: FormData) {
  await requireAdminUser();
  const galleryId = formData.get("galleryId") as string;
  if (!galleryId) throw new Error("Gallery ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("galleries").delete().eq("id", galleryId);

  if (error) {
    console.error("Gagal hapus galeri:", error);
    throw new Error("Gagal menghapus galeri.");
  }

  revalidatePath("/dashboard/admin/cms");
}

// === ARTICLE ACTIONS ===
export async function createArticleAction(formData: FormData) {
  const user = await requireAdminUser();
  const siteId = formData.get("siteId") as string;
  const title = formData.get("title") as string;
  const excerpt = formData.get("excerpt") as string;
  const contentText = formData.get("content") as string;
  const file = formData.get("cover") as File;

  if (!siteId || !title || !contentText) throw new Error("Judul dan konten artikel wajib diisi.");

  const db = await createUteroAcademyServiceRoleClient();
  let coverPath: string | null = null;

  if (file && file.size > 0) {
    // Validasi isi berkas tetap berlaku meski bucket "article" publik.
    let cover;
    try {
      cover = await validateUpload(file, ["image"]);
    } catch (error) {
      if (error instanceof UploadValidationError) throw new Error(error.message);
      console.error("Gagal memvalidasi cover artikel:", error);
      throw new Error("Gambar cover tidak dapat diproses.");
    }

    const supabase = createSupabaseServiceRoleClient();
    const filePath = buildStoragePath("article", cover.ext);

    const { error: uploadError } = await supabase.storage
      .from("article")
      .upload(filePath, cover.buffer, {
        contentType: cover.contentType,
        upsert: false
      });

    if (uploadError) {
      console.error("Gagal upload cover artikel:", uploadError);
      throw new Error("Gagal mengunggah gambar cover.");
    }

    // Object path, bukan URL publik. Diselesaikan di `getCmsData()`.
    coverPath = filePath;
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const { error } = await db.from("articles").insert({
    site_id: siteId,
    title,
    slug,
    excerpt: excerpt || null,
    content: { text: contentText },
    cover_path: coverPath,
    status: "published",
    author_id: user.id,
    published_at: new Date().toISOString()
  });

  if (error) {
    console.error("Gagal buat artikel:", error);
    throw new Error("Gagal menerbitkan artikel.");
  }

  revalidatePath("/dashboard/admin/cms");
}

export async function deleteArticleAction(formData: FormData) {
  await requireAdminUser();
  const artId = formData.get("artId") as string;
  if (!artId) throw new Error("Article ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("articles").delete().eq("id", artId);

  if (error) {
    console.error("Gagal hapus artikel:", error);
    throw new Error("Gagal menghapus artikel.");
  }

  revalidatePath("/dashboard/admin/cms");
}

export async function publishTestimonialAction(formData: FormData) {
  await requireAdminUser();
  const testId = formData.get("testId") as string;
  if (!testId) throw new Error("Testimonial ID tidak valid.");

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db.from("testimonials").update({ status: "published" }).eq("id", testId);

  if (error) {
    console.error("Gagal publish testimonial:", error);
    throw new Error("Gagal mempublikasikan testimoni.");
  }

  revalidatePath("/dashboard/admin/cms");
}

export async function submitInternTestimonialAction(formData: FormData) {
  // Aksi ini memang untuk user login biasa; kepemilikan divalidasi lewat
  // intern_profiles.user_id, bukan lewat role.
  const user = await requireUser();

  const db = await createUteroAcademyServiceRoleClient();
  const { data: internProfile } = await db
    .from("intern_profiles")
    .select("id, full_name, status, major")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!internProfile || internProfile.status !== "completed") {
    throw new Error("Hanya peserta magang yang telah menyelesaikan masa magang yang dapat mengisi testimoni.");
  }

  const quote = formData.get("quote") as string;
  const file = formData.get("photo") as File;
  const siteId = formData.get("siteId") as string;

  if (!quote) throw new Error("Kutipan testimoni wajib diisi.");

  let photoPath: string | null = null;
  if (file && file.size > 0) {
    // Validasi isi berkas tetap berlaku meski bucket "gallery" publik — dan di
    // sini ekstra penting: pengunggahnya peserta, bukan staf.
    let photo;
    try {
      photo = await validateUpload(file, ["image"]);
    } catch (error) {
      if (error instanceof UploadValidationError) throw new Error(error.message);
      console.error("Gagal memvalidasi foto testimoni peserta:", error);
      throw new Error("Foto testimoni tidak dapat diproses.");
    }

    const supabaseService = createSupabaseServiceRoleClient();
    const filePath = buildStoragePath("testimonial", photo.ext);
    const { error: uploadError } = await supabaseService.storage
      .from("gallery")
      .upload(filePath, photo.buffer, { contentType: photo.contentType, upsert: false });
    if (!uploadError) {
      // Object path, bukan URL publik. Diselesaikan di `getCmsData()`.
      photoPath = filePath;
    }
  }

  const { data: maxOrder } = await db.from("testimonials").select("order_index").eq("site_id", siteId).order("order_index", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("testimonials").insert({
    site_id: siteId,
    name: internProfile.full_name,
    role: "Alumni Magang - " + (internProfile.major || "Utero Academy"),
    quote,
    photo_path: photoPath,
    order_index: nextOrder,
    status: "draft",
    intern_id: internProfile.id
  });

  if (error) {
    console.error("Gagal simpan testimoni intern:", error);
    throw new Error("Gagal menyimpan testimoni.");
  }

  revalidatePath("/dashboard/intern/certificate");
  revalidatePath("/dashboard/admin/cms");
}

export async function updateLandingPageSettingsAction(formData: FormData) {
  await requireAdminUser();
  const heroTitle = formData.get("heroTitle") as string;
  const heroDescription = formData.get("heroDescription") as string;
  // Object path dari `LandingPageEditor`, bukan URL. Dulu `heroImageUrl`: nilai
  // tersimpan dimuat ke state klien lalu dikirim balik apa adanya, jadi nama itu
  // membuat penulisan URL penuh kembali ke DB terlihat benar.
  const heroImagePath = formData.get("heroImagePath") as string;
  const skillsJson = formData.get("skillsJson") as string;
  const expertisersJson = formData.get("expertisersJson") as string;
  const aboutText = formData.get("aboutText") as string;
  const contactEmail = formData.get("contactEmail") as string;
  const contactPhone = formData.get("contactPhone") as string;
  const contactAddress = formData.get("contactAddress") as string;
  const termsContent = formData.get("termsContent") as string;
  const partnershipsJson = formData.get("partnershipsJson") as string;

  if (!heroTitle || !heroDescription) {
    throw new Error("Hero Title dan Hero Description wajib diisi.");
  }

  let skills = [];
  let expertisers = [];

  try {
    skills = JSON.parse(skillsJson || "[]");
  } catch (e) {
    throw new Error("Format data Skills Competencies tidak valid.");
  }

  try {
    expertisers = JSON.parse(expertisersJson || "[]");
  } catch (e) {
    throw new Error("Format data Top Expertiser tidak valid.");
  }

  let partnerships = [];
  try {
    partnerships = JSON.parse(partnershipsJson || "[]");
  } catch (e) {
    throw new Error("Format data Partnerships tidak valid.");
  }

  const db = await createUteroAcademyServiceRoleClient();
  const { error } = await db
    .from("landing_page_settings")
    .upsert({
      id: "00000000-0000-0000-0000-000000000002",
      hero_title: heroTitle,
      hero_description: heroDescription,
      hero_image_path: heroImagePath || null,
      skills,
      expertisers,
      about_text: aboutText || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      contact_address: contactAddress || null,
      terms_content: termsContent || null,
      partnerships,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("Gagal simpan landing page settings:", error);
    throw new Error("Gagal menyimpan pengaturan Landing Page.");
  }

  revalidatePath("/");
  revalidatePath("/dashboard/admin/cms");
}

/**
 * Mengunggah satu berkas CMS, lalu mengembalikan **path dan URL sekaligus**.
 *
 * Sebelumnya hanya URL yang dikembalikan, jadi object path-nya hilang di batas
 * klien — dan `hero_image_path` yang bolak-balik lewat input tersembunyi di
 * `LandingPageEditor` tidak punya path untuk dikirim balik.
 *
 * Empat pemanggilnya perlu bentuk berbeda, dan itu bukan inkonsistensi:
 *
 * - `hero_image_path` adalah **kolom** tersendiri, jadi ia menyimpan `path`;
 *   `getLandingPageSettings` yang menyelesaikannya saat dibaca.
 * - `skills[].icon_url`, `expertisers[].avatar`, `partnerships[].logo_url` ada di
 *   dalam JSONB bebas-isi yang juga memuat path aset lokal dan URL eksternal.
 *   Tidak ada lapisan yang bisa menyelesaikannya tanpa merusak kedua bentuk itu,
 *   jadi ketiganya menyimpan `url`. Aman karena bucket `gallery` tetap publik:
 *   URL-nya tanpa token dan tidak kedaluwarsa.
 */
export async function uploadCmsFileAction(formData: FormData): Promise<{ path: string; url: string }> {
  await requireAdminUser();
  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    throw new Error("File tidak ditemukan.");
  }

  // Ekstensi & MIME dari isi berkas; bucket "gallery" publik.
  let asset;
  try {
    asset = await validateUpload(file, ["image"]);
  } catch (error) {
    if (error instanceof UploadValidationError) throw new Error(error.message);
    console.error("Gagal memvalidasi berkas CMS:", error);
    throw new Error("Berkas tidak dapat diproses.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const filePath = buildStoragePath("expert", asset.ext);

  const { error: uploadError } = await supabase.storage
    .from("gallery")
    .upload(filePath, asset.buffer, {
      contentType: asset.contentType,
      upsert: false
    });

  if (uploadError) {
    console.log("Gagal upload berkas CMS:", uploadError);
    throw new Error("Gagal mengunggah foto.");
  }

  const { data: { publicUrl } } = supabase.storage.from("gallery").getPublicUrl(filePath);
  return { path: filePath, url: publicUrl };
}
