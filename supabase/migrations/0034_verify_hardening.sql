-- Asersi pengencangan. BACA SAJA — tidak satu pun pernyataan di berkas ini
-- mengubah apa pun.
--
-- Dijalankan TERAKHIR, setelah 0028-0033, dan aman diulang kapan pun. Setiap
-- blok `raise exception` kalau ada lubang yang tersisa; notice kalau lolos.
--
-- Berkas ini adalah satu-satunya bukti otomatis yang dimiliki batch ini —
-- repo tidak punya test framework, dan lubang RLS tidak memunculkan error
-- (predikat yang salah mengembalikan nol baris, yang di aplikasi tampil sebagai
-- "tidak ada data"). Karena itu asersinya memeriksa KEADAAN KATALOG, bukan
-- perilaku: keadaan katalog bisa diperiksa tanpa sesi per role.
--
-- Yang TIDAK bisa dibuktikan di sini, dan tetap butuh walkthrough manual:
-- apakah predikat policy mengembalikan baris yang benar untuk tiap role. Blok
-- ini hanya membuktikan tidak ada tabel tanpa penjagaan, tidak ada policy
-- selimut, dan tidak ada sisa grant anon.

-- ---------------------------------------------------------------------------
-- (1) Setiap tabel di utero_academy harus punya RLS aktif.
do $$
declare
  daftar text;
  jumlah int;
begin
  select count(*), string_agg(c.relname, ', ' order by c.relname)
    into jumlah, daftar
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'utero_academy'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if jumlah > 0 then
    raise exception
      'ADA % TABEL TANPA RLS di utero_academy: %. '
      'Tabel tanpa RLS sepenuhnya terbuka bagi siapa pun yang punya grant.',
      jumlah, daftar;
  end if;

  raise notice 'Lolos (1): seluruh tabel utero_academy punya RLS aktif.';
end
$$;

-- ---------------------------------------------------------------------------
-- (2) Tidak boleh ada policy selimut: qual = 'true' atau with_check = 'true'
-- yang berlaku untuk anon atau authenticated.
--
-- Perlu pengecualian, dan masing-masing disebut alasannya — sebuah allowlist
-- yang bertambah tanpa alasan tertulis adalah cara asersi ini kehilangan
-- gunanya:
--
--   roles_select                        katalog peran, sumber tersemat
--                                       roles(code, name); bukan data pribadi
--   attendance_settings_select          peserta perlu tahu jam kerja; SELECT
--                                       saja, tulis dibatasi staf
--   badges_select                       katalog lencana, definisi bukan data
--   internship_applications_public_insert  formulir pendaftaran publik; INSERT
--                                       saja, tanpa SELECT
--   {programs,curriculums,batches,classes,schools}_select  konfigurasi program,
--                                       dibutuhkan setiap dashboard
--   {cms_*,articles,faqs,galleries,testimonials,article_categories,
--    landing_page_settings}_select      konten yang memang akan terbit; hanya
--                                       untuk authenticated, anon tidak dapat
--                                       policy apa pun
--
-- Perhatikan yang TIDAK ada di daftar: tidak satu pun policy `for all` boleh
-- ber-qual 'true'. Kalau muncul, itu pasangan seperti 0004:31 yang kembali
-- hidup.
do $$
declare
  p record;
  jumlah int := 0;
  rincian text := '';
  dikecualikan text[] := array[
    'roles_select',
    'attendance_settings_select',
    'badges_select',
    'internship_applications_public_insert',
    'programs_select', 'curriculums_select', 'batches_select',
    'classes_select', 'schools_select',
    'cms_sites_select', 'cms_pages_select', 'cms_sections_select',
    'cms_navigation_items_select', 'article_categories_select',
    'articles_select', 'faqs_select', 'galleries_select',
    'testimonials_select', 'landing_page_settings_select'
  ];
begin
  for p in
    select
      pol.tablename,
      pol.policyname,
      pol.cmd,
      pol.qual,
      pol.with_check,
      pol.roles
    from pg_catalog.pg_policies pol
    where pol.schemaname = 'utero_academy'
      and (
        btrim(coalesce(pol.qual, ''))       in ('true', '(true)')
        or btrim(coalesce(pol.with_check, '')) in ('true', '(true)')
      )
      and (pol.roles::text[] && array['anon', 'authenticated', 'public'])
      and not (pol.policyname = any (dikecualikan))
    order by pol.tablename, pol.policyname
  loop
    jumlah := jumlah + 1;
    rincian := rincian || format(
      '%s.%s (%s, roles=%s) ', p.tablename, p.policyname, p.cmd, p.roles);
  end loop;

  if jumlah > 0 then
    raise exception
      'ADA % POLICY SELIMUT di luar allowlist: %. '
      'Policy ber-qual true memberi akses tanpa syarat apa pun.',
      jumlah, trim(rincian);
  end if;

  raise notice 'Lolos (2): tidak ada policy selimut di luar allowlist beralasan.';
end
$$;

-- ---------------------------------------------------------------------------
-- (3) Setiap tabel dengan grant anon/authenticated harus punya policy.
--
-- Inilah kombinasi yang berbahaya dan tidak terlihat: grant ada, RLS aktif,
-- policy nol. RLS aktif tanpa policy memang MENOLAK semua baris, jadi ini bukan
-- lubang baca — tapi ia lubang KESALAHPAHAMAN: fitur yang seharusnya jalan
-- lewat klien sesi akan mengembalikan nol baris tanpa error, dan itu tampil
-- sebagai "tidak ada data", bukan sebagai kegagalan. Grant tanpa policy berarti
-- salah satu dari keduanya salah.
do $$
declare
  r record;
  jumlah int := 0;
  rincian text := '';
begin
  for r in
    select distinct g.table_name
    from information_schema.role_table_grants g
    where g.table_schema = 'utero_academy'
      and g.grantee in ('anon', 'authenticated')
      and not exists (
        select 1 from pg_catalog.pg_policies pol
        where pol.schemaname = 'utero_academy'
          and pol.tablename = g.table_name
      )
    order by g.table_name
  loop
    jumlah := jumlah + 1;
    rincian := rincian || r.table_name || ' ';
  end loop;

  if jumlah > 0 then
    raise exception
      'ADA % TABEL BERGRANT TAPI TANPA POLICY: %. '
      'Entah grant-nya berlebih (cabut di 0031), atau policy-nya hilang '
      '(tambahkan di 0030*). Keadaan sekarang menolak semua baris secara senyap.',
      jumlah, trim(rincian);
  end if;

  raise notice 'Lolos (3): setiap tabel bergrant punya policy.';
end
$$;

-- ---------------------------------------------------------------------------
-- (4) Sisa grant anon, di luar satu pengecualian yang disengaja.
--
-- Mengulang asersi 0031 langkah (6) dengan sengaja: 0031 memeriksa keadaan
-- SEGERA setelah revoke, berkas ini memeriksanya setelah seluruh batch selesai.
-- Kalau 0032-0033 atau sebuah perubahan manual menghidupkan grant kembali,
-- di sinilah ia tertangkap.
do $$
declare
  r record;
  jumlah int := 0;
  rincian text := '';
begin
  for r in
    select table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'utero_academy'
      and grantee = 'anon'
      and not (table_name = 'internship_applications' and privilege_type = 'INSERT')
    order by table_name, privilege_type
  loop
    jumlah := jumlah + 1;
    rincian := rincian || format('%s:%s ', r.table_name, r.privilege_type);
  end loop;

  if jumlah > 0 then
    raise exception
      'ADA % GRANT ANON di luar allowlist: %. '
      'Kunci anon publik dikirim ke setiap browser — grant ini setara akses publik.',
      jumlah, trim(rincian);
  end if;

  raise notice 'Lolos (4): hanya internship_applications:INSERT yang terbuka untuk anon.';
end
$$;

-- ---------------------------------------------------------------------------
-- (5) Default privileges tidak boleh lagi menyebut anon.
--
-- Kalau masih ada, setiap TABEL BARU akan lahir terbuka untuk anon — lubang
-- yang muncul kembali dengan sendirinya di migrasi berikutnya. Ini juga yang
-- menangkap kasus no-op senyap: ALTER DEFAULT PRIVILEGES ... REVOKE hanya
-- berlaku untuk default milik role yang menjalankannya, jadi 0031 bisa "sukses"
-- tanpa mengubah apa pun kalau dijalankan oleh role yang berbeda dari pemasang
-- default 0007.
do $$
declare
  jumlah int;
  pelaku text;
begin
  select count(*), string_agg(distinct pg_get_userbyid(d.defaclrole), ', ')
    into jumlah, pelaku
  from pg_catalog.pg_default_acl d
  join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'utero_academy'
    and array_to_string(d.defaclacl, ',') like '%anon=%';

  if jumlah > 0 then
    raise exception
      'ALTER DEFAULT PRIVILEGES masih memberi hak ke anon (% entri, dipasang '
      'oleh: %). Jalankan ulang 0031 sebagai role tersebut — tabel baru masih '
      'akan lahir terbuka untuk anon.',
      jumlah, pelaku;
  end if;

  raise notice 'Lolos (5): default privileges tidak lagi menyebut anon.';
end
$$;

-- ---------------------------------------------------------------------------
-- (6) View harus security_invoker.
--
-- Diperiksa lewat reloptions: `alter view ... set (security_invoker = true)`
-- menyimpannya di sana. Absen atau bernilai false berarti view jalan dengan hak
-- pemiliknya dan melewati RLS tabel di baliknya.
do $$
declare
  v record;
  jumlah int := 0;
  rincian text := '';
begin
  for v in
    select c.relname, coalesce(array_to_string(c.reloptions, ','), '(kosong)') as opsi
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'utero_academy'
      and c.relkind = 'v'
      and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'
    order by c.relname
  loop
    jumlah := jumlah + 1;
    rincian := rincian || format('%s[%s] ', v.relname, v.opsi);
  end loop;

  if jumlah > 0 then
    raise exception
      'ADA % VIEW TANPA security_invoker: %. '
      'View seperti ini jalan dengan hak pemiliknya dan melewati RLS tabel '
      'di baliknya. Jalankan 0033.',
      jumlah, trim(rincian);
  end if;

  raise notice 'Lolos (6): seluruh view security_invoker = true.';
end
$$;

-- ---------------------------------------------------------------------------
-- (7) Setiap fungsi harus punya search_path tetap.
do $$
declare
  f record;
  jumlah int := 0;
  rincian text := '';
begin
  for f in
    select
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
      p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'utero_academy'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
    order by p.proname
  loop
    jumlah := jumlah + 1;
    rincian := rincian || format(
      '%s(%s)%s ', f.proname, f.args,
      case when f.prosecdef then ' [SECURITY DEFINER]' else '' end);
  end loop;

  if jumlah > 0 then
    raise exception
      'ADA % FUNGSI TANPA search_path tetap: %. '
      'Yang bertanda SECURITY DEFINER adalah eskalasi hak: pemanggil bisa '
      'menyelipkan schema berisi tabel palsu di depan utero_academy. '
      'Jalankan 0033.',
      jumlah, trim(rincian);
  end if;

  raise notice 'Lolos (7): seluruh fungsi punya search_path tetap.';
end
$$;

-- ---------------------------------------------------------------------------
-- (8) storage.objects tidak boleh punya policy selimut.
--
-- Nama-nama 0007 diperiksa eksplisit, bukan hanya polanya: "Public Access"
-- (SELECT using true untuk SEMUA bucket), "Authenticated Upload",
-- "Authenticated Update", "Authenticated Delete" (ketiganya hanya memeriksa
-- bucket_id, tanpa cek owner — setiap user login bisa menimpa objek siapa pun).
do $$
declare
  p record;
  jumlah int := 0;
  rincian text := '';
begin
  for p in
    select policyname, cmd, coalesce(qual, '') as qual, roles
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname in (
          'Public Access', 'Authenticated Upload',
          'Authenticated Update', 'Authenticated Delete'
        )
        or (
          btrim(coalesce(qual, '')) in ('true', '(true)')
          and roles::text[] && array['anon', 'authenticated', 'public']
        )
      )
    order by policyname
  loop
    jumlah := jumlah + 1;
    rincian := rincian || format('%s (%s) ', p.policyname, p.cmd);
  end loop;

  if jumlah > 0 then
    raise exception
      'ADA % POLICY LONGGAR pada storage.objects: %. Jalankan 0032a.',
      jumlah, trim(rincian);
  end if;

  raise notice 'Lolos (8): tidak ada policy selimut pada storage.objects.';
end
$$;

-- ---------------------------------------------------------------------------
-- (9) Bucket sensitif harus privat dan berbatas.
--
-- Bagian privat hanya diperingatkan (warning), tidak dibatalkan: 0032b memang
-- SENGAJA belum dijalankan sampai backfill P7 tuntas, dan berkas ini harus bisa
-- lolos di sela itu untuk membuktikan pengencangan yang lain.
--
-- Batas ukuran/mime BUKAN peringatan tapi kegagalan: 0032a aman dijalankan
-- kapan pun, jadi tidak ada alasan sah ia belum jalan.
do $$
declare
  b record;
  masih_publik text := '';
  tanpa_batas text := '';
begin
  for b in
    select id, public, file_size_limit, allowed_mime_types
    from storage.buckets
    order by id
  loop
    if b.id in ('avatars', 'daily-report', 'task', 'learning', 'certificate')
       and b.public then
      masih_publik := masih_publik || b.id || ' ';
    end if;

    if b.file_size_limit is null or b.allowed_mime_types is null then
      tanpa_batas := tanpa_batas || b.id || ' ';
    end if;
  end loop;

  if length(tanpa_batas) > 0 then
    raise exception
      'BUCKET TANPA BATAS ukuran atau jenis berkas: %. Jalankan 0032a.',
      trim(tanpa_batas);
  end if;

  if length(masih_publik) > 0 then
    raise warning
      'Bucket sensitif masih publik: %. Ini diharapkan SEBELUM backfill P7; '
      'setelah backfill, jalankan 0032b. Selama masih publik, berkas di bucket '
      'itu terunduh tanpa autentikasi apa pun.',
      trim(masih_publik);
  else
    raise notice 'Lolos (9b): seluruh bucket sensitif privat.';
  end if;

  raise notice 'Lolos (9a): seluruh bucket punya batas ukuran dan jenis berkas.';
end
$$;

-- ---------------------------------------------------------------------------
-- (10) Ringkasan postur — notice, bukan asersi. Untuk dibaca operatornya.
do $$
declare
  tabel int;
  ber_policy int;
  policy_total int;
  fungsi int;
  secdef int;
begin
  select count(*) into tabel
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'utero_academy' and c.relkind = 'r';

  select count(distinct tablename), count(*) into ber_policy, policy_total
  from pg_catalog.pg_policies
  where schemaname = 'utero_academy';

  select count(*), count(*) filter (where prosecdef) into fungsi, secdef
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'utero_academy' and p.prokind in ('f', 'p');

  raise notice '--- Ringkasan postur utero_academy ---';
  raise notice 'Tabel: % (RLS aktif semua, diasersi di blok 1)', tabel;
  raise notice 'Tabel ber-policy: % dari % — % policy total', ber_policy, tabel, policy_total;
  raise notice 'Fungsi: % (% SECURITY DEFINER), search_path dipaku semua', fungsi, secdef;

  if ber_policy < tabel then
    raise notice
      'CATATAN: % tabel tanpa policy. RLS aktif tanpa policy MENOLAK semua '
      'baris — aman selama tabel itu hanya disentuh service role, tapi periksa '
      'apakah memang begitu.',
      tabel - ber_policy;
  end if;
end
$$;
