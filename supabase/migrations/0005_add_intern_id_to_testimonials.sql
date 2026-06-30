-- Migration 0005: Add intern_id to testimonials and make buckets unlimited size
ALTER TABLE utero_academy.testimonials 
ADD COLUMN IF NOT EXISTS intern_id uuid REFERENCES utero_academy.intern_profiles(id) ON DELETE SET NULL;

-- Make all storage buckets unlimited file size limit
UPDATE storage.buckets 
SET file_size_limit = NULL 
WHERE id IN ('avatars', 'gallery', 'article', 'daily-report', 'task', 'learning');
