import { createUteroAcademyServiceRoleClient } from "@/lib/supabase/server";
import { type CmsSite, type Faq, type Testimonial, type Gallery, type Article } from "./types";

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

  return {
    faqs: (faqsRes.data || []) as Faq[],
    testimonials: (testimonialsRes.data || []) as Testimonial[],
    galleries: (galleriesRes.data || []) as Gallery[],
    articles: (articlesRes.data || []) as Article[],
    error: faqsRes.error || testimonialsRes.error || galleriesRes.error || articlesRes.error
  };
}
