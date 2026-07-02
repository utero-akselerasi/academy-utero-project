-- Migration 0008: Sync all auth.users into utero_academy.user_profiles

INSERT INTO utero_academy.user_profiles (id, full_name, phone, is_active, created_at, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', SPLIT_PART(email, '@', 1), 'User'), 
  raw_user_meta_data->>'phone', 
  true, 
  created_at, 
  updated_at
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
  full_name = EXCLUDED.full_name,
  phone = COALESCE(utero_academy.user_profiles.phone, EXCLUDED.phone),
  updated_at = now();

-- Auto-provision mentor_profiles for admin/mentor users if not exist
INSERT INTO utero_academy.mentor_profiles (user_id, created_at, updated_at)
SELECT ur.user_id, now(), now()
FROM utero_academy.user_roles ur
JOIN utero_academy.roles r ON r.id = ur.role_id
WHERE r.code IN ('admin')
ON CONFLICT (user_id) DO NOTHING;

-- Auto-provision intern_profiles for intern users if not exist
INSERT INTO utero_academy.intern_profiles (user_id, full_name, phone, email, status, created_at, updated_at)
SELECT ur.user_id, up.full_name, up.phone, u.email, 'active', now(), now()
FROM utero_academy.user_roles ur
JOIN utero_academy.roles r ON r.id = ur.role_id
JOIN utero_academy.user_profiles up ON up.id = ur.user_id
JOIN auth.users u ON u.id = ur.user_id
WHERE r.code = 'intern'
ON CONFLICT (user_id) DO NOTHING;
