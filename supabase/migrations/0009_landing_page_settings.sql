-- Migration 0009: Add Landing Page Settings Table

CREATE TABLE IF NOT EXISTS utero_academy.landing_page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_title text NOT NULL,
  hero_description text NOT NULL,
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  expertisers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE utero_academy.landing_page_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE utero_academy.landing_page_settings TO anon;

-- Insert default configurations
INSERT INTO utero_academy.landing_page_settings (id, hero_title, hero_description, skills, expertisers)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Accelerate Your Career with Academy Utero',
  'Utero Academy adalah wadah kreatif dan interaktif bagi peserta magang untuk belajar langsung dengan para ahli di industri desain, digital printing, branding, videografi, dan XR (VR/AR/MR).',
  '[
    {"name": "Graphic Design", "desc": "Desain grafis dan komunikasi visual"},
    {"name": "Digital Printing", "desc": "Teknik cetak digital dan produksi"},
    {"name": "Branding", "desc": "Strategi merek dan identitas bisnis"},
    {"name": "Videography", "desc": "Produksi dan editing video kreatif"},
    {"name": "Social Media", "desc": "Pengelolaan dan strategi konten media sosial"},
    {"name": "Augmented Reality", "desc": "Teknologi realitas bertambah"},
    {"name": "Virtual Reality", "desc": "Teknologi realitas maya"},
    {"name": "Mix Reality", "desc": "Teknologi realitas campuran"},
    {"name": "Extended Reality", "desc": "Pengembangan ekosistem XR"},
    {"name": "Immersive Projection", "desc": "Pemetaan proyeksi imersif"}
  ]'::jsonb,
  '[
    {"name": "Dadik Wahyu Chang", "role": "BRAND CONSULTANT", "avatar": "/images/expert-dadik.jpg"},
    {"name": "Fitri Labuda", "role": "HEAD OF UTERO ACADEMY", "avatar": "/images/expert-fitri.jpg"},
    {"name": "Siti Sodrianti", "role": "PRODUCT MANAGER", "avatar": "/images/expert-siti.jpg"},
    {"name": "Wijayanty Lestari", "role": "BRAND RESEARCH", "avatar": "/images/expert-wijayanty.jpg"}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
