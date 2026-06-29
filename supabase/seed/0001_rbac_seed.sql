insert into utero_academy.roles (code, name, description)
values
  ('super_admin', 'Super Admin', 'Full system access'),
  ('admin_academy', 'Admin Academy', 'Academy operational administrator'),
  ('mentor', 'Mentor', 'Mentor for assigned interns and classes'),
  ('school', 'School or Campus', 'School monitoring portal user'),
  ('intern', 'Peserta Magang', 'Intern participant'),
  ('visitor', 'Visitor', 'Public unauthenticated visitor role reference')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into utero_academy.permissions (code, name, description)
values
  ('cms.read', 'Read CMS', 'Read CMS content'),
  ('cms.write', 'Write CMS', 'Create and update CMS content'),
  ('cms.publish', 'Publish CMS', 'Publish CMS content'),
  ('users.manage', 'Manage Users', 'Create and update users'),
  ('roles.manage', 'Manage Roles', 'Manage roles and permissions'),
  ('programs.manage', 'Manage Programs', 'Manage programs, curriculum, batches, and classes'),
  ('applications.read', 'Read Applications', 'Read internship applications'),
  ('applications.review', 'Review Applications', 'Review internship applications'),
  ('interns.read', 'Read Interns', 'Read intern profiles'),
  ('interns.manage', 'Manage Interns', 'Manage intern lifecycle'),
  ('mentors.assign', 'Assign Mentors', 'Assign mentors to interns'),
  ('lms.read', 'Read LMS', 'Read learning content'),
  ('lms.manage', 'Manage LMS', 'Manage courses, lessons, quizzes, and assignments'),
  ('tasks.read', 'Read Tasks', 'Read task boards and cards'),
  ('tasks.manage', 'Manage Tasks', 'Create and update task boards and cards'),
  ('tasks.submit', 'Submit Task Progress', 'Submit task comments, checklist progress, and attachments'),
  ('attendance.submit', 'Submit Attendance', 'Submit check-in and check-out'),
  ('attendance.review', 'Review Attendance', 'Review attendance records'),
  ('daily_reports.submit', 'Submit Daily Reports', 'Submit daily reports'),
  ('daily_reports.review', 'Review Daily Reports', 'Approve or request revision'),
  ('school_portal.read', 'Read School Portal', 'Read school scoped monitoring data'),
  ('assessments.write', 'Write Assessments', 'Create and update assessments'),
  ('assessments.finalize', 'Finalize Assessments', 'Finalize assessments'),
  ('certificates.generate', 'Generate Certificates', 'Generate certificate PDF'),
  ('certificates.read', 'Read Certificates', 'Read certificate metadata'),
  ('audit_logs.read', 'Read Audit Logs', 'Read audit logs')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into utero_academy.role_permissions (role_id, permission_id)
select r.id, p.id
from utero_academy.roles r
cross join utero_academy.permissions p
where r.code = 'super_admin'
on conflict do nothing;

insert into utero_academy.role_permissions (role_id, permission_id)
select r.id, p.id
from utero_academy.roles r
join utero_academy.permissions p on p.code in (
  'cms.read',
  'cms.write',
  'cms.publish',
  'users.manage',
  'programs.manage',
  'applications.read',
  'applications.review',
  'interns.read',
  'interns.manage',
  'mentors.assign',
  'lms.read',
  'lms.manage',
  'tasks.read',
  'tasks.manage',
  'attendance.review',
  'daily_reports.review',
  'assessments.write',
  'assessments.finalize',
  'certificates.generate',
  'certificates.read',
  'audit_logs.read'
)
where r.code = 'admin_academy'
on conflict do nothing;

insert into utero_academy.role_permissions (role_id, permission_id)
select r.id, p.id
from utero_academy.roles r
join utero_academy.permissions p on p.code in (
  'interns.read',
  'lms.read',
  'tasks.read',
  'tasks.manage',
  'attendance.review',
  'daily_reports.review',
  'assessments.write',
  'certificates.read'
)
where r.code = 'mentor'
on conflict do nothing;

insert into utero_academy.role_permissions (role_id, permission_id)
select r.id, p.id
from utero_academy.roles r
join utero_academy.permissions p on p.code in (
  'interns.read',
  'tasks.read',
  'attendance.review',
  'daily_reports.review',
  'school_portal.read',
  'certificates.read'
)
where r.code = 'school'
on conflict do nothing;

insert into utero_academy.role_permissions (role_id, permission_id)
select r.id, p.id
from utero_academy.roles r
join utero_academy.permissions p on p.code in (
  'lms.read',
  'tasks.read',
  'tasks.submit',
  'attendance.submit',
  'daily_reports.submit',
  'certificates.read'
)
where r.code = 'intern'
on conflict do nothing;

