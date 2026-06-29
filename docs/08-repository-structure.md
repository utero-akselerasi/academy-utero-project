# Repository Structure

Recommended structure for the implementation phase.

```text
.
├── app/
│   ├── (public)/
│   ├── (auth)/
│   ├── dashboard/
│   │   ├── super-admin/
│   │   ├── admin/
│   │   ├── mentor/
│   │   ├── school/
│   │   └── intern/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   └── feature/
├── config/
├── docs/
├── features/
│   ├── cms/
│   ├── website/
│   ├── lkp/
│   ├── internship/
│   ├── lms/
│   ├── tasks/
│   ├── attendance/
│   ├── daily-reports/
│   ├── school-portal/
│   └── assessments/
├── lib/
│   ├── auth/
│   ├── rbac/
│   ├── supabase/
│   ├── validation/
│   └── pdf/
├── scripts/
├── supabase/
│   ├── migrations/
│   ├── seed/
│   └── functions/
├── types/
└── tests/
```

## Feature Module Pattern

Each feature folder should contain only the pieces owned by that feature.

```text
features/tasks/
├── actions/
├── components/
├── queries/
├── schemas/
├── types/
└── utils/
```

## Naming Conventions

- Database tables use snake_case plural names.
- TypeScript files use kebab-case.
- React components use PascalCase.
- Server-only utilities live under `lib/` or feature-level `queries` and `actions`.
- Shared UI primitives live under `components/ui`.
- Business-specific UI lives under `features/*/components`.

## Dashboard Routing

All users authenticate from one login page. After login, redirect by primary role:

- `super_admin` -> `/dashboard/super-admin`
- `admin_academy` -> `/dashboard/admin`
- `mentor` -> `/dashboard/mentor`
- `school` -> `/dashboard/school`
- `intern` -> `/dashboard/intern`

