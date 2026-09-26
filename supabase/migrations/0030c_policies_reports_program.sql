-- Policy RLS domain laporan harian, program/kelas, penilaian, sertifikat, sekolah.
--
-- Tidak satu pun tabel di berkas ini disentuh klien sesi — seluruh titik
-- baca/tulis memakai service role. Policy di sini adalah lapis kedua yang
-- sesungguhnya: ia menentukan apa yang terlihat kalau kunci anon atau sesi
-- bicara langsung ke PostgREST, dan ia harus benar meski aplikasi tidak
-- bergantung padanya.
--
-- Satu pengecualian: school_reports sudah punya policy yang benar dari 0016 dan
-- route /dashboard/school/reports benar-benar bersandar padanya. Kedua policy
-- 0016 ditegaskan ulang di sini agar berkas berdiri sendiri, dengan satu
-- perbaikan: 0016 menulisnya tanpa klausa `to`, sehingga policy juga berlaku
-- untuk anon.
--
-- Pola yang dipakai berulang:
--   milik peserta : exists (select 1 from utero_academy.intern_profiles ip
--                   where ip.id = <t>.intern_id and ip.user_id = auth.uid())
--   staf          : current_user_has_role('admin') or ...('super_admin')
--   scope sekolah : exists (... intern_profiles ip
--                   join school_contacts sc on sc.school_id = ip.school_id
--                   where ip.id = <t>.intern_id and sc.user_id = auth.uid())

-- ---------------------------------------------------------------------------
-- daily_reports
--
-- Matriks: submit = intern "Milik sendiri", admin "Tidak"; review = admin.
-- Sama seperti attendances: staf dapat select + update, TANPA insert.
alter table utero_academy.daily_reports enable row level security;

drop policy if exists daily_reports_select on utero_academy.daily_reports;
drop policy if exists daily_reports_intern_write on utero_academy.daily_reports;
drop policy if exists daily_reports_staff_update on utero_academy.daily_reports;

create policy daily_reports_select on utero_academy.daily_reports
for select to authenticated
using (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = daily_reports.intern_id and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.intern_profiles ip
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where ip.id = daily_reports.intern_id and sc.user_id = auth.uid()
  )
);

-- INSERT dan UPDATE peserta digabung dalam satu FOR ALL yang dibatasi
-- kepemilikan. DELETE ikut tercakup dan itu disengaja: peserta boleh membatalkan
-- laporan hariannya sendiri (berbeda dari absensi, yang catatan waktunya tidak
-- boleh dihilangkan).
create policy daily_reports_intern_write on utero_academy.daily_reports
for all to authenticated
using (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = daily_reports.intern_id and ip.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = daily_reports.intern_id and ip.user_id = auth.uid()
  )
);

create policy daily_reports_staff_update on utero_academy.daily_reports
for update to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- ---------------------------------------------------------------------------
-- daily_report_attachments
--
-- Tidak punya kolom pemilik; kepemilikan diturunkan lewat report_id.
alter table utero_academy.daily_report_attachments enable row level security;

drop policy if exists daily_report_attachments_select on utero_academy.daily_report_attachments;
drop policy if exists daily_report_attachments_intern_write on utero_academy.daily_report_attachments;

create policy daily_report_attachments_select on utero_academy.daily_report_attachments
for select to authenticated
using (
  exists (
    select 1
    from utero_academy.daily_reports dr
    join utero_academy.intern_profiles ip on ip.id = dr.intern_id
    where dr.id = daily_report_attachments.report_id
      and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.daily_reports dr
    join utero_academy.intern_profiles ip on ip.id = dr.intern_id
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where dr.id = daily_report_attachments.report_id
      and sc.user_id = auth.uid()
  )
);

create policy daily_report_attachments_intern_write on utero_academy.daily_report_attachments
for all to authenticated
using (
  exists (
    select 1
    from utero_academy.daily_reports dr
    join utero_academy.intern_profiles ip on ip.id = dr.intern_id
    where dr.id = daily_report_attachments.report_id
      and ip.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from utero_academy.daily_reports dr
    join utero_academy.intern_profiles ip on ip.id = dr.intern_id
    where dr.id = daily_report_attachments.report_id
      and ip.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- daily_report_reviews
--
-- Catatan review pembimbing. Peserta boleh MEMBACA review laporannya sendiri —
-- itu memang umpan baliknya — tapi tidak boleh menulis apa pun.
alter table utero_academy.daily_report_reviews enable row level security;

drop policy if exists daily_report_reviews_select on utero_academy.daily_report_reviews;
drop policy if exists daily_report_reviews_staff_write on utero_academy.daily_report_reviews;

create policy daily_report_reviews_select on utero_academy.daily_report_reviews
for select to authenticated
using (
  exists (
    select 1
    from utero_academy.daily_reports dr
    join utero_academy.intern_profiles ip on ip.id = dr.intern_id
    where dr.id = daily_report_reviews.report_id
      and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.daily_reports dr
    join utero_academy.intern_profiles ip on ip.id = dr.intern_id
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where dr.id = daily_report_reviews.report_id
      and sc.user_id = auth.uid()
  )
);

create policy daily_report_reviews_staff_write on utero_academy.daily_report_reviews
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- ---------------------------------------------------------------------------
-- programs, curriculums, batches
--
-- Konfigurasi program. Tidak sensitif dan dibutuhkan setiap dashboard, jadi
-- dibaca-saja untuk seluruh user login. Tulis hanya staf (permission
-- 'programs.manage' di matriks dipegang admin).
--
-- Sapuan lewat loop supaya pola yang identik tidak diulang tiga kali dan tidak
-- bisa menyimpang satu dari yang lain.
do $$
declare
  t text;
  staf constant text :=
    'utero_academy.current_user_has_role(''admin'') '
    'or utero_academy.current_user_has_role(''super_admin'')';
begin
  foreach t in array array['programs', 'curriculums', 'batches', 'classes', 'schools']
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'utero_academy' and c.relname = t and c.relkind = 'r'
    ) then
      raise notice 'Tabel tidak ditemukan, dilewati: %', t;
      continue;
    end if;

    execute format('alter table utero_academy.%I enable row level security', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_select', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_staff_write', t);
    execute format(
      'create policy %I on utero_academy.%I for select to authenticated using (true)',
      t || '_select', t);
    execute format(
      'create policy %I on utero_academy.%I for all to authenticated using (%s) with check (%s)',
      t || '_staff_write', t, staf, staf);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- class_enrollments
--
-- Siapa mengikuti kelas apa. Peserta melihat pendaftarannya sendiri.
alter table utero_academy.class_enrollments enable row level security;

drop policy if exists class_enrollments_select on utero_academy.class_enrollments;
drop policy if exists class_enrollments_staff_write on utero_academy.class_enrollments;

create policy class_enrollments_select on utero_academy.class_enrollments
for select to authenticated
using (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = class_enrollments.intern_id and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.intern_profiles ip
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where ip.id = class_enrollments.intern_id and sc.user_id = auth.uid()
  )
);

create policy class_enrollments_staff_write on utero_academy.class_enrollments
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- ---------------------------------------------------------------------------
-- assessments
--
-- Penilaian akhir. Peserta hanya boleh melihat penilaian yang SUDAH final —
-- status 'draft' dan 'submitted' adalah catatan kerja pembimbing, dan
-- membocorkannya lebih awal mengubah arti prosesnya.
alter table utero_academy.assessments enable row level security;

drop policy if exists assessments_select on utero_academy.assessments;
drop policy if exists assessments_staff_write on utero_academy.assessments;

create policy assessments_select on utero_academy.assessments
for select to authenticated
using (
  (
    status = 'finalized'
    and exists (
      select 1 from utero_academy.intern_profiles ip
      where ip.id = assessments.intern_id and ip.user_id = auth.uid()
    )
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or (
    status = 'finalized'
    and exists (
      select 1
      from utero_academy.intern_profiles ip
      join utero_academy.school_contacts sc on sc.school_id = ip.school_id
      where ip.id = assessments.intern_id and sc.user_id = auth.uid()
    )
  )
);

create policy assessments_staff_write on utero_academy.assessments
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- ---------------------------------------------------------------------------
-- certificates
--
-- Peserta melihat sertifikatnya sendiri. Status 'revoked' tetap terlihat
-- olehnya — pemegang sertifikat yang dicabut berhak tahu.
alter table utero_academy.certificates enable row level security;

drop policy if exists certificates_select on utero_academy.certificates;
drop policy if exists certificates_staff_write on utero_academy.certificates;

create policy certificates_select on utero_academy.certificates
for select to authenticated
using (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = certificates.intern_id and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.intern_profiles ip
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where ip.id = certificates.intern_id and sc.user_id = auth.uid()
  )
);

create policy certificates_staff_write on utero_academy.certificates
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- ---------------------------------------------------------------------------
-- school_contacts
--
-- Tabel ini adalah SUMBER predikat scope sekolah di seluruh berkas 0030*, jadi
-- kebenarannya menentukan kebenaran yang lain. Kontak sekolah melihat barisnya
-- sendiri; penulisan hanya staf.
--
-- CATATAN PENTING: tabel ini dibaca dari dalam klausa USING policy tabel lain,
-- dan RLS BERLAKU untuk subquery itu (referensi tabel di dalam policy tetap
-- melewati RLS tabel yang dirujuk — itulah sebabnya Postgres bisa melempar
-- "infinite recursion detected in policy"). Predikat scope di tabel lain tetap
-- bekerja karena setiap subquery-nya sudah memfilter sc.user_id = auth.uid(),
-- dan policy select di bawah memperlihatkan persis baris-baris itu. Tidak ada
-- rekursi: policy school_contacts tidak merujuk tabel lain mana pun.
alter table utero_academy.school_contacts enable row level security;

drop policy if exists school_contacts_select on utero_academy.school_contacts;
drop policy if exists school_contacts_staff_write on utero_academy.school_contacts;

create policy school_contacts_select on utero_academy.school_contacts
for select to authenticated
using (
  user_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

create policy school_contacts_staff_write on utero_academy.school_contacts
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- ---------------------------------------------------------------------------
-- school_reports
--
-- Satu-satunya policy berbentuk benar yang sudah ada di repo (0016:38-48), dan
-- satu-satunya yang benar-benar menanggung beban lewat route
-- /dashboard/school/reports. Ditegaskan ulang dengan satu perbaikan: 0016
-- menulis keduanya TANPA klausa `to`, sehingga policy juga berlaku untuk anon.
alter table utero_academy.school_reports enable row level security;

drop policy if exists school_reports_select_own_school on utero_academy.school_reports;
drop policy if exists school_reports_admin_all on utero_academy.school_reports;

create policy school_reports_select_own_school on utero_academy.school_reports
for select to authenticated
using (
  exists (
    select 1 from utero_academy.school_contacts sc
    where sc.school_id = school_reports.school_id
      and sc.user_id = auth.uid()
  )
);

create policy school_reports_admin_all on utero_academy.school_reports
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);
