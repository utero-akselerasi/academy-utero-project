"use server";

import { createSupabaseServerClient, createUteroAcademyServiceRoleClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userRole } = await supabase
    .schema("utero_academy")
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", user.id)
    .maybeSingle();

  const roleObj = Array.isArray(userRole?.roles) ? userRole.roles[0] : userRole?.roles;
  if (roleObj?.code !== "admin") {
    redirect("/login");
  }
  return user;
}

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
  let photoUrl: string | null = null;

  if (file && file.size > 0) {
    const supabase = createSupabaseServiceRoleClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `testimonial/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error("Gagal upload foto testimoni:", uploadError);
      throw new Error("Gagal mengunggah foto testimoni.");
    }

    const { data: { publicUrl } } = supabase.storage.from("gallery").getPublicUrl(filePath);
    photoUrl = publicUrl;
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
    photo_path: photoUrl,
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

  const supabase = createSupabaseServiceRoleClient();
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `gallery/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("gallery")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true
    });

  if (uploadError) {
    console.error("Gagal upload gambar galeri:", uploadError);
    throw new Error("Gagal mengunggah file gambar.");
  }

  const { data: { publicUrl } } = supabase.storage.from("gallery").getPublicUrl(filePath);

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
    image_path: publicUrl,
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
  let coverUrl: string | null = null;

  if (file && file.size > 0) {
    const supabase = createSupabaseServiceRoleClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `article/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("article")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error("Gagal upload cover artikel:", uploadError);
      throw new Error("Gagal mengunggah gambar cover.");
    }

    const { data: { publicUrl } } = supabase.storage.from("article").getPublicUrl(filePath);
    coverUrl = publicUrl;
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const { error } = await db.from("articles").insert({
    site_id: siteId,
    title,
    slug,
    excerpt: excerpt || null,
    content: { text: contentText },
    cover_path: coverUrl,
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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  let photoUrl = null;
  if (file && file.size > 0) {
    const supabaseService = createSupabaseServiceRoleClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = "testimonial/" + Date.now() + "." + ext;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const { error: uploadError } = await supabaseService.storage.from("gallery").upload(filePath, buffer, { contentType: file.type, upsert: true });
    if (!uploadError) {
      const { data: { publicUrl } } = supabaseService.storage.from("gallery").getPublicUrl(filePath);
      photoUrl = publicUrl;
    }
  }

  const { data: maxOrder } = await db.from("testimonials").select("order_index").eq("site_id", siteId).order("order_index", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (maxOrder?.order_index ?? -1) + 1;

  const { error } = await db.from("testimonials").insert({
    site_id: siteId,
    name: internProfile.full_name,
    role: "Alumni Magang - " + (internProfile.major || "Utero Academy"),
    quote,
    photo_path: photoUrl,
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
  const heroImageUrl = formData.get("heroImageUrl") as string;
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
      hero_image_path: heroImageUrl || null,
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

export async function uploadCmsFileAction(formData: FormData): Promise<string> {
  await requireAdminUser();
  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    throw new Error("File tidak ditemukan.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = "expert/" + Date.now() + "_" + Math.random().toString(36).substring(2, 8) + "." + ext;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("gallery")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true
    });

  if (uploadError) {
    console.log("Gagal upload berkas CMS:", uploadError);
    throw new Error("Gagal mengunggah foto.");
  }

  const { data: { publicUrl } } = supabase.storage.from("gallery").getPublicUrl(filePath);
  return publicUrl;
}
