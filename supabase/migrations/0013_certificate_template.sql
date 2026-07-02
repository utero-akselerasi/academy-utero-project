-- Migration 0013: Add certificate template path to settings
ALTER TABLE utero_academy.attendance_settings
ADD COLUMN IF NOT EXISTS certificate_template_path text;
