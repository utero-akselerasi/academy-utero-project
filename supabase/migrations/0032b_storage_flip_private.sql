-- Pengencangan storage, bagian kedua: jadikan bucket sensitif privat.
--
-- ======================================================================
-- JANGAN JALANKAN BERKAS INI SEBELUM BACKFILL P7 TERVERIFIKASI.
-- ======================================================================
--
-- Mem-flip public = false membuat setiap URL publik yang tersimpan di database
-- mati seketika. Tiga belas kolom masih menyimpan URL publik penuh (peta K-1),
-- dan selama nilai itu belum dipangkas jadi object path, memprivatkan bucket
-- berarti: selfie absensi hilang dari halaman review, CV pendaftar tidak bisa
-- dibuka, lampiran laporan harian dan task jadi tautan mati.
--
-- Urutan yang benar, tidak boleh dibalik:
--
--   1. P5  lib/storage-urls.ts + konversi 16 titik tulis & ~60 titik baca
--          (titik tulis menyimpan path, titik baca menandatangani)
--   2. P7  backfill kolom: UPDATE memangkas prefix URL -> object path
--   3.     VERIFIKASI: tidak ada baris tersisa yang nilainya diawali 'http'
--          pada ketiga belas kolom itu
--   4. BARU berkas ini
--
-- Langkah 3 bukan formalitas. Asersi di bawah menegakkannya: berkas ini
-- MEMBATALKAN DIRINYA SENDIRI kalau masih ada satu baris pun yang menyimpan URL.
-- Itu memang yang diinginkan — lebih baik migrasi gagal daripada gambar hilang
-- dari produksi.

-- ---------------------------------------------------------------------------
-- (1) Palang pengaman: batalkan kalau backfill belum tuntas.
--
-- Diperiksa dengan `like 'http%'`, bukan pencocokan domain: nilai yang disimpan
-- pernah memakai host berbeda (contoh env memakai http://, produksi https://
-- supabase.carubra.com), dan object path yang sah tidak pernah diawali 'http'
-- — buildStoragePath() di lib/uploads.ts selalu menghasilkan prefix seperti
-- '<userId>/', 'cv/', 'portfolio/', atau 'settings/'.
--
-- Penjaga keberadaan tabel/kolom dipakai lewat information_schema: kalau satu
-- kolom sudah dihapus atau belum ada di produksi, jangan batalkan seluruh
-- migrasi — cukup lewati pemeriksaannya.
do $$
declare
  pasangan text[][] := array[
    array['attendances', 'check_in_selfie_path'],
    array['attendances', 'check_out_selfie_path'],
    array['attendances', 'out_of_range_proof_path'],
    array['attendances', 'sick_certificate_path'],
    array['permits', 'attachment_path'],
    array['user_profiles', 'avatar_path'],
    array['internship_applications', 'cv_path'],
    array['internship_applications', 'portfolio_path'],
    array['attendance_settings', 'certificate_template_path'],
    array['daily_report_attachments', 'file_path'],
    array['task_attachments', 'file_path'],
    array['assignment_submissions', 'attachment_path']
  ];
  i int;
  tabel text;
  kolom text;
  sisa bigint;
  total bigint := 0;
  rincian text := '';
begin
  for i in 1 .. array_length(pasangan, 1)
  loop
    tabel := pasangan[i][1];
    kolom := pasangan[i][2];

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'utero_academy'
        and table_name = tabel
        and column_name = kolom
    ) then
      raise notice 'Kolom tidak ditemukan, dilewati: %.%', tabel, kolom;
      continue;
    end if;

    -- daily_report_attachments.file_path punya pengecualian sah: baris dengan
    -- mime_type = 'url' menyimpan tautan Google Drive, bukan object path
    -- (features/daily-reports/actions.ts:145). Baris itu MEMANG diawali http
    -- dan tidak boleh ikut memicu pembatalan.
    if tabel = 'daily_report_attachments' then
      execute format(
        'select count(*) from utero_academy.%I '
        'where %I like ''http%%'' and coalesce(mime_type, '''') <> ''url''',
        tabel, kolom) into sisa;
    else
      execute format(
        'select count(*) from utero_academy.%I where %I like ''http%%''',
        tabel, kolom) into sisa;
    end if;

    if sisa > 0 then
      total := total + sisa;
      rincian := rincian || format('%s.%s=%s ', tabel, kolom, sisa);
    end if;
  end loop;

  if total > 0 then
    raise exception
      'Backfill belum tuntas: % baris masih menyimpan URL penuh (%). '
      'Mem-flip bucket jadi privat sekarang akan mematikan berkas-berkas itu. '
      'Jalankan backfill P7 lebih dulu, lalu ulangi migrasi ini.',
      total, trim(rincian);
  end if;

  raise notice 'Palang pengaman lolos: tidak ada kolom yang masih menyimpan URL penuh.';
end
$$;

-- ---------------------------------------------------------------------------
-- (2) Jadikan privat.
--
-- Lima bucket. `avatars` ikut meski di seed/0002 ia public = true, karena ia
-- keranjang campur: avatar profil bersama CV, portofolio, selfie absensi, surat
-- sakit, dan template sertifikat. Satu flag `public` tidak bisa memisahkan
-- avatar dari surat sakit — jadi seluruh bucket diprivatkan dan avatar pun
-- dibaca lewat signed URL (ditandatangani di ProtectedDashboardLayout, titik
-- render terpanas di aplikasi).
--
-- Empat bucket TETAP publik dan itu disengaja: `gallery`, `article`, `mentor`,
-- `school-logo`. Keempatnya dirender di halaman publik yang di-cache
-- (app/(public)/*, revalidatePath("/")) tanpa sesi. Signed URL ber-TTL justru
-- merusak cache itu, dan isinya memang untuk dilihat siapa pun.
--
-- public = false TIDAK dengan sendirinya menutup akses: policy
-- public_buckets_read di 0032a-lah yang membatasi SELECT ke keempat bucket
-- publik. Keduanya dibutuhkan — flag ini mematikan endpoint /object/public/,
-- policy itu mengatur siapa yang boleh SELECT baris storage.objects.
update storage.buckets
set public = false
where id in ('avatars', 'daily-report', 'task', 'learning', 'certificate');

-- ---------------------------------------------------------------------------
-- (3) Tegaskan hasilnya.
do $$
declare
  masih_publik text;
begin
  select string_agg(id, ', ' order by id) into masih_publik
  from storage.buckets
  where public = true
    and id in ('avatars', 'daily-report', 'task', 'learning', 'certificate');

  if masih_publik is not null then
    raise exception 'Bucket masih publik setelah flip: %', masih_publik;
  end if;

  select string_agg(id, ', ' order by id) into masih_publik
  from storage.buckets
  where public = false
    and id in ('gallery', 'article', 'mentor', 'school-logo');

  if masih_publik is not null then
    raise warning
      'Bucket yang seharusnya publik ternyata privat: %. '
      'Gambar di halaman publik akan hilang. Periksa 0032a dan seed/0002.',
      masih_publik;
  end if;

  raise notice 'Lima bucket sensitif kini privat; empat bucket konten publik tetap publik.';
end
$$;
