# RBAC Permission Matrix

## Roles

- `super_admin`
- `admin_academy`
- `mentor`
- `school`
- `intern`
- `visitor`

## Matrix

| Feature | Super Admin | Admin Academy | Mentor | School | Intern | Visitor |
| --- | --- | --- | --- | --- | --- | --- |
| Public website view | Yes | Yes | Yes | Yes | Yes | Yes |
| Public registration | Yes | Yes | No | No | Yes | Yes |
| CMS manage content | Yes | Yes | No | No | No | No |
| CMS publish content | Yes | Yes | No | No | No | No |
| Manage users | Yes | Yes | No | No | No | No |
| Manage roles and permissions | Yes | No | No | No | No | No |
| Manage programs | Yes | Yes | No | No | No | No |
| Manage curriculum | Yes | Yes | No | No | No | No |
| Manage batches | Yes | Yes | No | No | No | No |
| Manage classes | Yes | Yes | No | No | No | No |
| Manage mentor assignment | Yes | Yes | No | No | No | No |
| View assigned interns | Yes | Yes | Yes | Scoped | Own | No |
| Manage tasks | Yes | Yes | Scoped | Read | Scoped | No |
| Submit task progress | No | No | No | No | Yes | No |
| Submit attendance | No | No | No | No | Yes | No |
| Review attendance | Yes | Yes | Scoped | Read | Own | No |
| Submit daily report | No | No | No | No | Yes | No |
| Review daily report | Yes | Yes | Scoped | Read | Own | No |
| Manage LMS courses | Yes | Yes | Scoped | No | No | No |
| Access LMS materials | Yes | Yes | Yes | No | Scoped | No |
| Submit quiz and assignment | No | No | No | No | Yes | No |
| View school dashboard | Yes | Yes | No | Scoped | No | No |
| Input assessment | Yes | Yes | Scoped | No | No | No |
| Finalize assessment | Yes | Yes | No | No | No | No |
| Generate certificate | Yes | Yes | No | No | No | No |
| View certificate | Yes | Yes | Scoped | Scoped | Own | No |
| View audit log | Yes | Scoped | No | No | No | No |

## Scope Notes

- `Scoped` for mentors means records related to assigned interns, assigned classes, assigned boards, or assigned courses.
- `Scoped` for schools means records related to students from the school or campus.
- `Own` means the authenticated user's own participant record.

