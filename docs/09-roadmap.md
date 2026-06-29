# Implementation Roadmap

## Phase 1: Analysis

- Business process diagram
- User journey
- Sitemap
- Flowchart setiap modul
- Finalisasi module boundary
- Finalisasi role dan scope data

## Phase 2: Design

- ERD detail
- PostgreSQL schema
- RBAC and permission matrix
- API contract
- Storage bucket policy
- Audit log policy
- Status lifecycle design

## Phase 3: Documentation

- PRD
- SDD
- UI component guideline
- Coding standard
- Repository structure
- Definition of done
- Testing strategy

## Phase 4: Implementation

1. Setup Next.js, TypeScript, Tailwind CSS.
2. Setup Supabase Self-Hosted project structure.
3. Implement auth and RBAC base.
4. Implement public website pages.
5. Implement CMS content models.
6. Implement internship registration and admin review.
7. Implement mentor and intern dashboard.
8. Implement task management.
9. Implement attendance.
10. Implement daily report.
11. Implement LMS.
12. Implement assessment and certificate generation.
13. Implement school portal.

## Phase 5: Integration

- Email notification
- WhatsApp notification via WAHA
- Push notification
- PDF generator
- Digital signature
- Dashboard analytics
- Monitoring
- Audit log viewer

## Suggested First Sprint

### Goal

Create the technical foundation and a thin vertical slice from public registration to admin review.

### Scope

- Initialize Next.js project.
- Configure TypeScript and Tailwind CSS.
- Configure Supabase client.
- Create auth pages.
- Create RBAC tables and seed roles.
- Create initial `internship_applications` table.
- Build public registration form.
- Build admin application review page.

### Exit Criteria

- Visitor can submit registration.
- Admin can see submitted registration.
- Admin can update registration status.
- Data is stored in PostgreSQL.
- Role access is enforced.

