# API Contract

This document defines the first API surface. Final implementation may use Server Actions, Route Handlers, Supabase RPC, or a combination of those patterns.

## Conventions

- All protected endpoints require authenticated user context.
- All mutations validate role permissions.
- Response shape uses `data` and `error`.
- List endpoints support pagination with `page`, `per_page`, `sort`, and `q` where relevant.
- IDs use UUID.

## Public Website

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/public/site/:slug` | Get public site config |
| GET | `/api/public/pages/:slug` | Get public page content |
| GET | `/api/public/articles` | List published articles |
| GET | `/api/public/articles/:slug` | Get article detail |
| GET | `/api/public/faqs` | List published FAQ |
| POST | `/api/public/registrations` | Submit internship or program registration |

## CMS

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/cms/pages` | List pages |
| POST | `/api/cms/pages` | Create page |
| PATCH | `/api/cms/pages/:id` | Update page |
| POST | `/api/cms/pages/:id/publish` | Publish page |
| GET | `/api/cms/articles` | List articles |
| POST | `/api/cms/articles` | Create article |
| PATCH | `/api/cms/articles/:id` | Update article |
| POST | `/api/cms/articles/:id/publish` | Publish article |
| GET | `/api/cms/media` | List media |
| POST | `/api/cms/media` | Upload media metadata |

## Internship

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/internship/applications` | List applications |
| PATCH | `/api/internship/applications/:id/status` | Update application status |
| POST | `/api/internship/mentor-assignments` | Assign mentor to intern |
| GET | `/api/internship/interns` | List interns |
| GET | `/api/internship/interns/:id` | Get intern profile |
| PATCH | `/api/internship/interns/:id/status` | Update internship status |

## LMS

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/lms/courses` | List courses |
| POST | `/api/lms/courses` | Create course |
| GET | `/api/lms/courses/:id` | Get course detail |
| POST | `/api/lms/courses/:id/enrollments` | Enroll intern |
| POST | `/api/lms/lessons/:id/progress` | Update lesson progress |
| POST | `/api/lms/quizzes/:id/attempts` | Submit quiz attempt |
| POST | `/api/lms/assignments/:id/submissions` | Submit assignment |

## Task Management

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/tasks/boards` | List boards |
| POST | `/api/tasks/boards` | Create board |
| POST | `/api/tasks/lists` | Create list |
| PATCH | `/api/tasks/lists/:id` | Update list |
| POST | `/api/tasks/cards` | Create card |
| PATCH | `/api/tasks/cards/:id` | Update card |
| POST | `/api/tasks/cards/:id/comments` | Add comment |
| POST | `/api/tasks/cards/:id/attachments` | Add attachment |

## Attendance

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/attendance/check-in` | Submit check-in |
| POST | `/api/attendance/check-out` | Submit check-out |
| GET | `/api/attendance` | List attendance records |
| PATCH | `/api/attendance/:id/review` | Review or correct attendance |

## Daily Report

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/daily-reports` | List reports |
| POST | `/api/daily-reports` | Submit report |
| GET | `/api/daily-reports/:id` | Get report detail |
| PATCH | `/api/daily-reports/:id` | Update report |
| POST | `/api/daily-reports/:id/reviews` | Approve or request revision |

## Assessment and Certificate

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/assessments` | Create assessment |
| PATCH | `/api/assessments/:id` | Update assessment |
| POST | `/api/assessments/:id/finalize` | Finalize assessment |
| POST | `/api/certificates/generate` | Generate certificate PDF |
| POST | `/api/certificates/:id/sign` | Apply digital signature |
| GET | `/api/certificates/:id` | Get certificate metadata |

