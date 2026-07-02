-- Migration 0010: Add About, Contact, and Terms fields to landing_page_settings

ALTER TABLE utero_academy.landing_page_settings 
ADD COLUMN IF NOT EXISTS about_text text DEFAULT 'Utero Academy berdiri sejak tahun 2010 sebagai bagian dari Utero Group untuk mencetak profesional kreatif handal di bidang desain, media digital, branding, dan teknologi imersif.',
ADD COLUMN IF NOT EXISTS contact_email text DEFAULT 'info@uterogroup.com',
ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT '081234567890',
ADD COLUMN IF NOT EXISTS contact_address text DEFAULT 'Jl. Sulfat Agung No.51, Purwantoro, Kec. Blimbing, Kota Malang, Jawa Timur 65126',
ADD COLUMN IF NOT EXISTS terms_content text DEFAULT '1. Peserta magang wajib mengikuti seluruh tata tertib akademi.\n2. Seluruh karya hasil bimbingan menjadi hak milik bersama Utero Academy.';
