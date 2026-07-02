-- Migration 0014: Add Geofencing coordinates and radius to attendance settings
ALTER TABLE utero_academy.attendance_settings
ADD COLUMN IF NOT EXISTS office_latitude double precision DEFAULT -7.9671,
ADD COLUMN IF NOT EXISTS office_longitude double precision DEFAULT 112.6375,
ADD COLUMN IF NOT EXISTS allow_geofencing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS radius_meters integer DEFAULT 100;
