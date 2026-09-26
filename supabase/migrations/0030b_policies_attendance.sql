-- Policy RLS domain absensi: attendances, permits, attendance_settings.
--
-- attendances adalah satu-satunya tabel di domain ini yang disentuh klien sesi
-- (features/attendance/queries.ts:7, :20, :44; actions.ts:172 check-in, :234
-- check-out, :265 review). permits dan attendance_settings seluruhnya lewat
-- service role — policy-nya lapis kedua, bukan jalur yang dipakai aplikasi.
--
-- Matriks (docs/05-rbac-permission-matrix.md): submit absensi = intern "Milik
-- sendiri", admin "Tidak"; review absensi = admin. Diterjemahkan:
--   intern : select + insert + update baris intern_id miliknya
--   staf   : select semua, update untuk review — TANPA insert (admin tidak
--            mengirim absensi atas nama peserta), TANPA delete (catatan absensi
--            tidak boleh dihilangkan oleh siapa pun lewat klien sesi)
--   school : select untuk peserta yang sekolahnya sama ("Sesuai scope")
--
-- Predikat kepemilikan peserta dipakai berulang, ditulis penuh setiap kali agar
-- setiap policy bisa dibaca sendiri:
--   exists (select 1 from utero_academy.intern_profiles ip
--           where ip.id = <t>.intern_id and ip.user_id = auth.uid())

-- ---------------------------------------------------------------------------
-- attendances
alter table utero_academy.attendances enable row level security;

drop policy if exists attendances_select on utero_academy.attendances;
drop policy if exists attendances_intern_insert on utero_academy.attendances;
drop policy if exists attendances_intern_update on utero_academy.attendances;
drop policy if exists attendances_staff_update on utero_academy.attendances;

create policy attendances_select on utero_academy.attendances
for select to authenticated
using (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = attendances.intern_id
      and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.intern_profiles ip
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where ip.id = attendances.intern_id
      and sc.user_id = auth.uid()
  )
);

-- Check-in (actions.ts:172). WITH CHECK mengikat intern_id ke profil pemanggil
-- — peserta tidak bisa menyisipkan absensi untuk intern_id lain. Status awal
-- 'pending' atau 'manual_review' dikirim aplikasi; tidak dibatasi di sini
-- karena kolom status juga berubah saat review (policy staf di bawah).
create policy attendances_intern_insert on utero_academy.attendances
for insert to authenticated
with check (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = attendances.intern_id
      and ip.user_id = auth.uid()
  )
);

-- Check-out (actions.ts:234). Peserta hanya menyentuh barisnya sendiri, dan
-- tidak bisa memindahkan baris ke intern_id lain.
create policy attendances_intern_update on utero_academy.attendances
for update to authenticated
using (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = attendances.intern_id
      and ip.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = attendances.intern_id
      and ip.user_id = auth.uid()
  )
);

-- Review (actions.ts:265). Pembatasan "hanya intern yang dibimbing" ditegakkan
-- aplikasi lewat requireInternInScope() sebelum update; di lapis DB staf boleh
-- mengubah baris mana pun. Kolom yang boleh diubah tidak bisa dibatasi oleh
-- policy — RLS bekerja per baris, bukan per kolom.
create policy attendances_staff_update on utero_academy.attendances
for update to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- Tanpa policy INSERT untuk staf dan tanpa policy DELETE untuk siapa pun.

-- ---------------------------------------------------------------------------
-- permits
--
-- RLS diaktifkan 0029. Seluruh titik (actions.ts:337 insert, :405 select,
-- :413 update) memakai service role. Policy di bawah menjaga tabel tetap
-- bermakna kalau suatu saat ada titik yang dipindah ke klien sesi, dan
-- menutup kemungkinan grant SELECT 0017:38 ke authenticated hidup kembali.
alter table utero_academy.permits enable row level security;

drop policy if exists permits_select on utero_academy.permits;
drop policy if exists permits_intern_insert on utero_academy.permits;
drop policy if exists permits_staff_update on utero_academy.permits;

create policy permits_select on utero_academy.permits
for select to authenticated
using (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = permits.intern_id
      and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.intern_profiles ip
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where ip.id = permits.intern_id
      and sc.user_id = auth.uid()
  )
);

-- Pengajuan izin: hanya untuk diri sendiri, dan hanya berstatus 'pending'.
-- Peserta tidak boleh menyisipkan izin yang sudah 'approved'.
create policy permits_intern_insert on utero_academy.permits
for insert to authenticated
with check (
  status = 'pending'
  and exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = permits.intern_id
      and ip.user_id = auth.uid()
  )
);

-- Review izin: staf saja. Peserta TIDAK mendapat update — izin yang sudah
-- diajukan tidak bisa diubah pengajunya (tidak ada fitur edit izin di aplikasi).
create policy permits_staff_update on utero_academy.permits
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
-- attendance_settings
--
-- Baris tunggal yang menentukan geofence seluruh peserta (office_latitude/
-- longitude, radius_meters, allow_geofencing). RLS diaktifkan 0029; grant
-- eksplisit 0006:31-32 ke anon DAN authenticated dicabut 0031.
--
-- Seluruh titik baca/tulis (actions.ts:104, :210, :371; assessments/actions.ts
-- :202; assessments/queries.ts:121; export/route.ts:130) memakai service role.
-- Nilai pengaturannya sendiri tidak rahasia bagi user login — peserta perlu
-- tahu jam masuk — jadi SELECT dibuka untuk authenticated. Tulis hanya staf.
alter table utero_academy.attendance_settings enable row level security;

drop policy if exists attendance_settings_select on utero_academy.attendance_settings;
drop policy if exists attendance_settings_staff_write on utero_academy.attendance_settings;

create policy attendance_settings_select on utero_academy.attendance_settings
for select to authenticated
using (true);

create policy attendance_settings_staff_write on utero_academy.attendance_settings
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);
