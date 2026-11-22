alter table utero_academy.selection_test_packages
  add column if not exists is_active boolean not null default true;

with ranked as (
  select id, row_number() over (partition by code order by version desc, published_at desc nulls last, id desc) as position
  from utero_academy.selection_test_packages where is_published
)
update utero_academy.selection_test_packages package
set is_active = ranked.position = 1
from ranked where package.id = ranked.id;

create unique index if not exists selection_one_active_published_package_idx
  on utero_academy.selection_test_packages (code)
  where is_published and is_active;

alter table utero_academy.selection_assignments
  drop constraint if exists selection_assignments_application_id_package_id_key;

create index if not exists selection_assignments_application_package_idx
  on utero_academy.selection_assignments (application_id, package_id, assigned_at desc);
