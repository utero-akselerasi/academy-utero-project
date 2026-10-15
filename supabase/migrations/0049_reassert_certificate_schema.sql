-- Reassert the certificate schema required by course certificate issuance.
-- Fail closed on incompatible data; never rewrite certificate rows.

do $$
begin
  if to_regclass('utero_academy.certificates') is null then
    raise exception 'utero_academy.certificates tidak ada';
  end if;

  if exists (
    select 1 from utero_academy.certificates
    where certificate_type is null
       or not (
         (certificate_type = 'assessment' and assessment_id is not null and course_id is null)
         or
         (certificate_type = 'course_completion' and course_id is not null and assessment_id is null)
       )
  ) then
    raise exception 'Data certificates melanggar certificates_assessment_or_course';
  end if;

  if exists (
    select 1 from utero_academy.certificates
    where course_id is not null
    group by intern_id, course_id
    having count(*) > 1
  ) then
    raise exception 'Data certificates memiliki duplikat intern_id/course_id';
  end if;

  if exists (
    select 1 from pg_attribute a
    where a.attrelid = 'utero_academy.certificates'::regclass
      and a.attname in ('final_score', 'notes')
      and not a.attisdropped
      and format_type(a.atttypid, a.atttypmod) is distinct from
        case a.attname when 'final_score' then 'numeric(5,2)' else 'text' end
  ) then
    raise exception 'Tipe final_score atau notes tidak sesuai kontrak certificates';
  end if;

  if to_regclass('utero_academy.idx_certificates_intern_course_unique') is not null
     and not exists (
       select 1
       from pg_index i
       join pg_class index_relation on index_relation.oid = i.indexrelid
       join pg_class table_relation on table_relation.oid = i.indrelid
       join pg_namespace n on n.oid = table_relation.relnamespace
       where n.nspname = 'utero_academy'
         and table_relation.relname = 'certificates'
         and index_relation.relname = 'idx_certificates_intern_course_unique'
         and i.indisunique
         and i.indisvalid
         and i.indisready
         and pg_get_indexdef(i.indexrelid) ~ '\(intern_id, course_id\) WHERE \(course_id IS NOT NULL\)$'
     ) then
    raise exception 'Index idx_certificates_intern_course_unique ada dengan definisi tidak sesuai';
  end if;
end
$$;

alter table utero_academy.certificates
  add column if not exists final_score numeric(5,2),
  add column if not exists notes text;

alter table utero_academy.certificates
  alter column assessment_id drop not null,
  alter column certificate_type set default 'assessment',
  alter column certificate_type set not null;

alter table utero_academy.certificates
  drop constraint if exists certificates_assessment_or_course;

alter table utero_academy.certificates
  add constraint certificates_assessment_or_course check (
    (certificate_type = 'assessment' and assessment_id is not null and course_id is null)
    or
    (certificate_type = 'course_completion' and course_id is not null and assessment_id is null)
  );

create unique index if not exists idx_certificates_intern_course_unique
  on utero_academy.certificates (intern_id, course_id)
  where course_id is not null;

comment on column utero_academy.certificates.final_score is
  'Nilai akhir. Untuk course_completion selalu 100.';
comment on column utero_academy.certificates.notes is
  'Catatan sertifikat, termasuk judul course completion.';
comment on column utero_academy.certificates.assessment_id is
  'NULL untuk certificate_type = course_completion.';
