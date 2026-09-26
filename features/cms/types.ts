export type PublishStatus = "draft" | "published";

export type CmsSite = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  created_at: string;
  updated_at: string;
};

export type Faq = {
  id: string;
  site_id: string;
  question: string;
  answer: string;
  order_index: number;
  status: PublishStatus;
  created_at: string;
  updated_at: string;
};

export type Testimonial = {
  id: string;
  site_id: string;
  name: string;
  role: string | null;
  quote: string;
  photo_path: string | null;
  order_index: number;
  status: PublishStatus;
  created_at: string;
  updated_at: string;
};

export type Gallery = {
  id: string;
  site_id: string;
  title: string;
  /**
   * Sudah diselesaikan di `queries.ts`; `null` kalau nilainya kosong atau bukan
   * objek storage yang dikenal. Bucket `gallery` publik, jadi ini URL publik
   * tanpa token — lihat catatan di `getCmsData`.
   */
  image_path: string | null;
  description: string | null;
  order_index: number;
  status: PublishStatus;
  created_at: string;
  updated_at: string;
};

export type Article = {
  id: string;
  site_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content: any;
  cover_path: string | null;
  status: PublishStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LandingPageSettings = {
  id: string;
  hero_title: string;
  hero_description: string;
  /** Nilai mentah DB (object path). Untuk dikirim balik lewat form, bukan dirender. */
  hero_image_path?: string | null;
  /** Hasil resolusi untuk dirender. Lihat `getLandingPageSettings`. */
  hero_image_url?: string | null;
  partnerships?: any;
  skills: any;
  expertisers: any;
  about_text?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  terms_content?: string;
  created_at: string;
  updated_at: string;
};
