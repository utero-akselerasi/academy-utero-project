-- Migration 0012: Add partnerships to landing_page_settings
ALTER TABLE utero_academy.landing_page_settings 
ADD COLUMN IF NOT EXISTS partnerships jsonb DEFAULT '[]'::jsonb;
