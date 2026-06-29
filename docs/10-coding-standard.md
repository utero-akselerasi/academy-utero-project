# Coding Standard

## General

- Use TypeScript for all application code.
- Keep feature-specific code inside `features/*`.
- Keep shared primitives inside `components/ui`.
- Keep server-only helpers inside `lib/*`.
- Prefer explicit names over abbreviations.
- Validate all external input before database writes.

## TypeScript

- Use strict TypeScript.
- Avoid `any` unless wrapping untyped third-party APIs.
- Prefer discriminated unions for workflow status.
- Put shared domain types in `types/`.
- Put feature-specific types in `features/*/types`.

## React and Next.js

- Use Server Components by default.
- Use Client Components only for interactivity.
- Use Server Actions or Route Handlers for mutations.
- Keep dashboard routes grouped by role.
- Do not put authorization only in UI. Enforce it in server code and database policy.

## Database

- Use snake_case table and column names.
- Use UUID primary keys.
- Include `created_at` and `updated_at` on mutable tables.
- Use explicit status fields for workflows.
- Enable Row Level Security on sensitive tables.
- Use audit logs for important changes.

## RBAC

- Permissions should use `resource.action` naming.
- Roles receive permissions through `role_permissions`.
- User roles should be scoped when possible.
- Super Admin is the only role that can manage permissions.

## Files and Storage

- Store files in Supabase Storage.
- Save storage object metadata in database tables when files belong to workflows.
- Use predictable paths:
  - `avatars/{user_id}/...`
  - `daily-report/{report_id}/...`
  - `task/{card_id}/...`
  - `certificate/{certificate_id}/...`
  - `learning/{course_id}/...`

## Testing

- Unit test pure business logic.
- Integration test important database workflows.
- End-to-end test registration, login, admin review, attendance, daily report, and certificate generation.

