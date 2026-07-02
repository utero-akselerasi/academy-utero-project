-- Migration 0011: Add hero_image_path to landing_page_settings
ALTER TABLE utero_academy.landing_page_settings 
ADD COLUMN IF NOT EXISTS hero_image_path text;
