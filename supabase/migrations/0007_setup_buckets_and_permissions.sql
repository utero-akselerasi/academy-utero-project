-- Migration 0007: Setup buckets and schema permissions to prevent permission denied errors

-- 1. Grant usage on schema
GRANT USAGE ON SCHEMA utero_academy TO postgres, service_role, authenticated, anon;

-- 2. Grant all privileges on all tables, sequences, functions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA utero_academy TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA utero_academy TO postgres, service_role, authenticated, anon;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA utero_academy TO postgres, service_role, authenticated, anon;

-- Ensure default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA utero_academy GRANT ALL PRIVILEGES ON TABLES TO postgres, service_role, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA utero_academy GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, service_role, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA utero_academy GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, service_role, authenticated, anon;

-- 3. Setup storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, null, null),
  ('gallery', 'gallery', true, null, null),
  ('article', 'article', true, null, null),
  ('daily-report', 'daily-report', true, null, null),
  ('task', 'task', true, null, null),
  ('learning', 'learning', true, null, null)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = null;

-- 4. Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies on storage.objects to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- Create storage policies
CREATE POLICY "Public Access" ON storage.objects 
  FOR SELECT USING (true);

CREATE POLICY "Authenticated Upload" ON storage.objects 
  FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('avatars', 'gallery', 'article', 'daily-report', 'task', 'learning'));

CREATE POLICY "Authenticated Update" ON storage.objects 
  FOR UPDATE TO authenticated USING (bucket_id IN ('avatars', 'gallery', 'article', 'daily-report', 'task', 'learning')) WITH CHECK (bucket_id IN ('avatars', 'gallery', 'article', 'daily-report', 'task', 'learning'));

CREATE POLICY "Authenticated Delete" ON storage.objects 
  FOR DELETE TO authenticated USING (bucket_id IN ('avatars', 'gallery', 'article', 'daily-report', 'task', 'learning'));
