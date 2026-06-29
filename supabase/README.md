# Supabase Setup

This folder contains the initial database and seed plan for Utero Academy Platform.

## Files

- `migrations/0001_initial_schema.sql`: core tables, enums, triggers, and indexes.
- `seed/0001_rbac_seed.sql`: initial roles and permissions.
- `seed/0002_storage_buckets.sql`: initial storage buckets.

## Recommended Order

1. Apply migrations.
2. Apply RBAC seed.
3. Apply storage bucket seed.
4. Create the first Super Admin user in Supabase Auth.
5. Insert the matching user profile and `super_admin` role assignment.

## Notes

- Sensitive tables should keep Row Level Security enabled.
- Policies are intentionally not finalized in this first pass because they depend on the exact app access pattern.
- The initial schema is broad enough to guide implementation, but migrations should still be reviewed before production use.

