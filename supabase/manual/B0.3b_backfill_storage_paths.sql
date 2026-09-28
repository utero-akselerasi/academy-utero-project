-- Backfill kolom storage: pangkas URL publik/bertanda-tangan menjadi object path.
--
-- =====================================================================
--   LANGKAH BERISIKO TERTINGGI DI SELURUH REMEDIASI.
--   BERKAS INI MENULIS ULANG BARIS PRODUKSI.
--   JANGAN JALANKAN TANPA IZIN EKSPLISIT DAN TERPISAH (fase P7 / B0.3b).
-- =====================================================================
--
-- ## Kenapa berkas ini TIDAK ada di supabase/migrations/
--
-- Sengaja ditaruh di `supabase/manual/`. `scripts/migrate.mjs` hanya menemukan
-- berkas di `supabase/migrations/` yang cocok pola `^(\d{4}[a-z]?)_.+\.sql$`,
-- jadi selama ia di sini, `npm run migrate:apply` **tidak mungkin**
-- menjalankannya bersama 0028-0032a.
--
-- Itu bukan soal kerapian, itu pemisahan gerbang izin. B0.3a (jalankan migrasi)
-- dan B0.3b (tulis ulang data) adalah dua izin berbeda dengan risiko berbeda:
-- migrasi RLS/grant bisa dibalik dengan grant ulang, sedangkan `UPDATE` di bawah
-- **menimpa nilai lama di tempat**. Kalau berkas ini bernomor, satu perintah
-- `--apply` akan melakukan keduanya, dan izin yang diberikan untuk yang satu
-- terpakai untuk yang lain.
--
-- Cara menjalankannya nanti, setelah izin:
--
--   psql "$DATABASE_URL" -f supabase/manual/B0.3b_backfill_storage_paths.sql
--
-- ## Cakupan: 16 kolom + 1 kunci JSONB
--
-- Prosa plan menyebut "13 kolom + 1 kunci JSONB", tapi tabel di plan yang sama
-- memuat **16** baris kolom. Hitungan yang benar adalah 16 -- angka 13 itu
-- keliru, dan dicatat di sini supaya tidak ada yang mengira ada tiga kolom yang
-- hilang dari berkas ini.
--
-- Rekonsiliasi dengan palang pengaman `0032b`, yang memeriksa **12** pasang:
-- keempat selisihnya adalah kolom bucket publik (`articles.cover_path`,
-- `testimonials.photo_path`, `galleries.image_path`,
-- `landing_page_settings.hero_image_path`). `0032b` tidak memeriksanya karena ia
-- tidak mem-flip `gallery`/`article` jadi privat, jadi URL sisa di sana tidak
-- akan mematikan gambar. 12 + 4 = 16. Konsisten.
--
-- Berkas ini tetap memangkas keempatnya. Manfaatnya bukan kerahasiaan (isinya
-- memang publik), tapi: kolom DB berhenti menyimpan base URL yang bisa berubah,
-- dan object path-nya tersedia untuk `storage.remove()` kalau penghapusan objek
-- yatim nanti dikerjakan.
--
-- ## Aturan pemangkasan
--
-- Mengikuti `toObjectPath()` di `lib/storage-urls.ts`, yang aturannya **sudah
-- dikunci test** di `tests/storage-paths.test.ts` (19 kasus):
--
--   1. cocokkan `/storage/v1/object/(public|sign|authenticated)/<bucket>/`
--      -- BUKAN perbandingan dengan base URL. Base-nya pernah berbeda (contoh
--      env memakai http://, produksi https://), jadi mencocokkan base akan
--      gagal senyap untuk baris yang ditulis dengan base lama.
--   2. buang query string (`?token=...`) -- `?` tidak pernah sah di object path
--   3. dekode escape persen (`%20` -> spasi)
--   4. buang slash depan (`//uid/x.jpg` adalah objek berbeda dari `uid/x.jpg`)
--
-- **Satu penyimpangan yang disengaja dari versi JS, dan ini perbaikan.**
-- `safeDecode()` di JS memanggil `decodeURIComponent()` atas seluruh string;
-- kalau ada satu `%` yang bukan escape sah, fungsinya melempar dan JS memakai
-- string **yang sama sekali belum didekode**. Jadi untuk `a%20b%.pdf`, JS
-- menghasilkan `a%20b%.pdf` sedangkan object path sebenarnya di Supabase adalah
-- `a b%.pdf` -- JS-nya yang salah di situ, dan salahnya berupa 404, bukan error.
--
-- Dekoder di bawah bekerja **per escape**, jadi `%20` tetap didekode meski ada
-- `%` liar di tempat lain: hasilnya `a b%.pdf`, nilai yang benar. Untuk ke-19
-- kasus yang dikunci test, kedua implementasi menghasilkan hal yang sama --
-- termasuk `100%.pdf`, yang di kedua jalur keluar utuh. Yang berbeda hanya
-- bentuk campuran di atas, dan di situ berkas ini yang benar.
--
-- Nilai yang **tidak** disentuh, dan ini yang menjaga datanya:
--
--   - object path yang sudah benar (tidak diawali `http`) -- klausa `where`
--     menyaringnya, jadi berkas ini **idempoten**: dijalankan dua kali hasilnya
--     sama.
--   - URL yang bucket-nya tidak cocok -- pola per kolom menyebut bucket yang
--     benar, jadi URL asing (cms.carubra.com, Google Drive) tidak pernah ikut
--     terpangkas.
--   - `daily_report_attachments.file_path` saat `mime_type = 'url'` -- itu
--     tautan Google Drive, bukan objek storage (features/daily-reports/actions.ts:145).
--   - `certificates.file_path` -- kolomnya ada (0001_initial_schema.sql:459) dan
--     dibaca, tapi **tak pernah ditulis**. Tidak ada di berkas ini.
--   - `school_reports.file_path` -- route aplikasi, bukan objek storage
--     (features/school/actions.ts:123).
--   - `skills` / `expertisers` / `partnerships` di `landing_page_settings` --
--     JSONB bebas-isi yang juga memuat path aset lokal (`/images/expert-dadik.jpg`)
--     dan URL eksternal tempelan admin. `/images/expert-dadik.jpg` bukan URL
--     absolut, jadi pemangkas akan mengubahnya jadi `images/expert-dadik.jpg` --
--     object path yang menghasilkan 404. Memangkasnya **merusak senyap** nilai
--     yang sudah benar. Lihat catatan panjang di features/cms/queries.ts:79-91.
--
-- ## Urutan yang mengikat
--
--   B0.3a  0028-0032a, 0033 (0032a: batas ukuran + policy storage.objects)
--   B0.3b  BERKAS INI
--   B0.3c  verifikasi nol baris berawalan 'http', baru 0032b (flip privat)
--
-- `0032b` punya palang pengaman yang membatalkan dirinya kalau masih ada baris
-- ber-URL, jadi urutan ini ditegakkan mesin, bukan cuma ditulis di sini.
--
-- ## Status verifikasi
--
-- Berkas ini **sudah dijalankan** di postgres 17 sekali-pakai (container Docker
-- lokal, database kosong, data buatan) -- **belum pernah** menyentuh produksi.
-- Yang terbukti di sana:
--
--   - jalan sampai `commit` tanpa error, 16 kolom + 1 JSONB terpangkas
--   - nilai hasilnya diperiksa satu per satu, bukan cuma exit code-nya
--   - tautan Google Drive (`mime_type='url'`) dan URL CMS asing tetap utuh
--   - urutan `lessons.attachments` terjaga; elemen non-objek dan path lokal
--     lolos tanpa disentuh; baris `[]` dan `null` dilewati
--   - **idempoten**: jalan kedua menulis 0 baris dan menambah 0 snapshot
--   - prosedur pemulihan di kaki berkas ini dijalankan dan mengembalikan nilai
--     aslinya, termasuk varian `::jsonb`
--   - **atomik**: satu baris dipangkas + di-snapshot, lalu asersi (5) gagal
--     karena baris lain -- keduanya hilang bersama rollback. Bukan sebagian.
--   - asersi (5) terbukti **bisa gagal**, dan menyebut kolom yang tepat
--   - uji (3) terbukti bisa gagal: empat mutasi sumber (trim slash, penolakan
--     bucket asing, pembuangan token, dekode persen) masing-masing membuatnya
--     merah
--
-- Satu celah **ditemukan justru lewat mutasi itu** dan sudah ditutup: versi
-- pertama uji (3) tidak punya satu pun kasus dengan slash **setelah** penanda
-- bucket, jadi menghapus `regexp_replace` di cabang penanda lolos tanpa
-- terdeteksi. Dua kasus `.../avatars//uid/...` ditambahkan. Ini persis jenis
-- kegagalan yang berkas ini ada untuk mencegah: path ganda tidak melempar, ia
-- cuma jadi objek berbeda yang 404.
--
-- Yang **tidak** dibuktikan oleh semua itu: bahwa bentuk nilai di produksi
-- persis sama dengan fixture. Itu yang dijawab inventaris Q1-Q13, dan itulah
-- kenapa gerbang izinnya tetap terpisah.

begin;

-- ---------------------------------------------------------------------------
-- (0) Snapshot, sebelum menulis apa pun.
--
-- Prasyarat, bukan kenyamanan: `UPDATE` di bawah menimpa nilai di tempat, dan
-- tanpa salinan ini tidak ada jalan kembali selain restore seluruh database.
--
-- Tabelnya dibuat di dalam transaksi yang sama dengan UPDATE-nya. Kalau ada satu
-- saja langkah yang gagal, snapshot-nya ikut hilang bersama rollback -- dan itu
-- benar: tidak ada yang berubah, jadi tidak ada yang perlu dipulihkan.
create table if not exists utero_academy.storage_path_backfill_snapshot (
  id bigserial primary key,
  nama_tabel text not null,
  nama_kolom text not null,
  id_baris text not null,
  nilai_lama text not null,
  dibuat_pada timestamptz not null default now()
);

comment on table utero_academy.storage_path_backfill_snapshot is
  'Salinan nilai kolom storage sebelum backfill B0.3b. Satu-satunya jalan pulih '
  'kalau aturan pemangkasan ternyata salah. Jangan dihapus sebelum B0.3c lolos '
  'dan berkas-berkas terbukti masih terbuka di produksi.';

-- Tabel ini lahir SETELAH 0029 mencabut default privileges, jadi ia tidak
-- mewarisi grant `anon`/`authenticated`. Ditegaskan ulang di sini karena isinya
-- justru nilai-nilai path yang sedang disembunyikan -- kalau urutan penerapan
-- ternyata terbalik di produksi, ini yang menutupnya.
revoke all on utero_academy.storage_path_backfill_snapshot from anon, authenticated;
revoke all on sequence utero_academy.storage_path_backfill_snapshot_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- (1) Dekoder escape persen.
--
-- Dipisah dari pemangkas supaya bisa diuji sendiri, dan supaya alasan bentuknya
-- terbaca di satu tempat.
--
-- Jalan pintas yang **tidak** dipakai:
--   convert_from(decode(regexp_replace(s,'%([0-9a-fA-F]{2})','\\x\1','g'),'escape'),'utf8')
-- Itu snippet yang beredar luas dan ia **salah**: `decode(..., 'escape')` hanya
-- menerima `\\` dan oktal `\nnn`, bukan hex `\xNN`, jadi ia melempar untuk
-- setiap escape. Dipakai bersama blok `exception`, akibatnya bukan error yang
-- terlihat melainkan `%20` yang **tidak pernah didekode** -- tepat jenis
-- kegagalan senyap yang berkas ini ada untuk mencegah.
--
-- Karena itu string-nya ditelusuri karakter demi karakter: `%` yang diikuti dua
-- digit hex jadi satu byte, sisanya apa adanya. Byte-nya dirakit sebagai bytea
-- dulu, baru sekali dikonversi ke utf8, supaya karakter multi-byte (`%E2%80%99`)
-- tersusun benar dan tidak dipotong per byte.
create or replace function utero_academy.b03b_percent_decode(nilai text)
returns text
language plpgsql
immutable
set search_path = utero_academy, public, pg_temp
as $$
declare
  byte_buf bytea := ''::bytea;
  i int := 1;
  n int;
  ch text;
  duo text;
begin
  if nilai is null then
    return null;
  end if;

  n := length(nilai);

  while i <= n loop
    ch := substring(nilai from i for 1);

    if ch = '%' and i + 2 <= n then
      duo := substring(nilai from i + 1 for 2);

      if duo ~ '^[0-9a-fA-F]{2}$' then
        byte_buf := byte_buf || decode(duo, 'hex');
        i := i + 3;
        continue;
      end if;
    end if;

    byte_buf := byte_buf || convert_to(ch, 'utf8');
    i := i + 1;
  end loop;

  return convert_from(byte_buf, 'utf8');
exception
  -- `convert_from` melempar kalau rangkaian byte hasil dekode bukan utf8 sah
  -- (mis. `%FF` tunggal). Satu nama berkas rusak tidak boleh menggagalkan
  -- seluruh backfill; nilainya dipakai apa adanya, dan kalau memang bermasalah
  -- ia akan terlihat di asersi bagian (5).
  when others then
    return nilai;
end
$$;

-- ---------------------------------------------------------------------------
-- (2) Pemangkas.
--
-- Dijadikan fungsi, bukan ekspresi yang diulang 17 kali: satu aturan di satu
-- tempat, dan ia bisa diuji sebelum dipakai menulis.
--
-- `search_path` dinyatakan eksplisit. `CREATE OR REPLACE FUNCTION` menghapus
-- `pg_proc.proconfig`, jadi fungsi yang dibuat setelah 0033 harus
-- menyatakannya ulang -- kalau tidak, pengencangan search_path di 0033 batal
-- untuk fungsi ini.
--
-- `immutable` benar: keluarannya hanya bergantung pada masukan, tidak membaca
-- tabel apa pun.
create or replace function utero_academy.b03b_to_object_path(nilai text, bucket text)
returns text
language plpgsql
immutable
set search_path = utero_academy, public, pg_temp
as $$
declare
  penanda text;
  posisi int := 0;
  jenis text;
  sisa text;
begin
  if nilai is null or btrim(nilai) = '' then
    return null;
  end if;

  nilai := btrim(nilai);

  -- Dicari lewat `position()` atas penanda lengkap yang memuat nama bucket,
  -- bukan `regexp_replace` dengan `.*`, supaya URL dari bucket lain tidak
  -- pernah kebetulan cocok lalu terpangkas dengan bucket yang salah.
  foreach jenis in array array['public', 'sign', 'authenticated']
  loop
    penanda := '/storage/v1/object/' || jenis || '/' || bucket || '/';
    posisi := position(penanda in nilai);
    exit when posisi > 0;
  end loop;

  if posisi = 0 then
    if nilai ~* '^https?://' then
      -- Berbentuk URL tapi bucket-nya tidak cocok: JANGAN diterka. `null` di
      -- sini membuat klausa `where` di bagian (4) melewati barisnya, bukan
      -- menuliskan path dengan bucket keliru yang berakhir 404.
      return null;
    end if;

    -- Bukan URL: sudah object path. Cukup rapikan slash depannya.
    return regexp_replace(nilai, '^/+', '');
  end if;

  sisa := substring(nilai from posisi + length(penanda));
  sisa := split_part(sisa, '?', 1);
  sisa := utero_academy.b03b_percent_decode(sisa);

  return regexp_replace(sisa, '^/+', '');
end
$$;

-- ---------------------------------------------------------------------------
-- (3) Uji pemangkasnya SEBELUM ia dipakai menulis.
--
-- Kasus-kasus ini kembar dengan tests/storage-paths.test.ts. Kalau satu saja
-- gagal, seluruh transaksi dibatalkan dan **tidak satu baris pun tersentuh** --
-- itulah gunanya menaruh uji ini di dalam `begin` yang sama.
do $$
declare
  kasus text[] := array[
    -- masukan | bucket | harapan ('<NULL>' berarti harus null)
    'uid/attendance_in/foto.jpg|avatars|uid/attendance_in/foto.jpg',
    'https://supabase.carubra.com/storage/v1/object/public/avatars/uid/foto.jpg|avatars|uid/foto.jpg',
    'http://supabase.carubra.com/storage/v1/object/public/avatars/uid/foto.jpg|avatars|uid/foto.jpg',
    'https://s.co/storage/v1/object/sign/avatars/uid/foto.jpg?token=eyJhbGci.abc|avatars|uid/foto.jpg',
    'https://s.co/storage/v1/object/authenticated/avatars/uid/foto.jpg|avatars|uid/foto.jpg',
    'https://supabase.carubra.com/storage/v1/object/public/avatars/uid/surat%20sakit.pdf|avatars|uid/surat sakit.pdf',
    'https://supabase.carubra.com/storage/v1/object/public/avatars/uid/100%.pdf|avatars|uid/100%.pdf',
    -- Campuran: `%20` sah di samping `%` liar. Di sinilah berkas ini SENGAJA
    -- berbeda dari `safeDecode()` JS, yang menyerah total dan mengembalikan
    -- `a%20b%.pdf`. Yang benar adalah `a b%.pdf`, dan itu yang dikunci di sini.
    'https://s.co/storage/v1/object/public/avatars/uid/a%20b%.pdf|avatars|uid/a b%.pdf',
    '/uid/foto.jpg|avatars|uid/foto.jpg',
    '///uid/foto.jpg|avatars|uid/foto.jpg',
    -- Slash SETELAH penanda bucket. Kasus ini terpisah dari dua di atas: yang
    -- itu lewat cabang "bukan URL", yang ini lewat cabang penanda -- dua
    -- `regexp_replace` berbeda di fungsinya. Tanpa kasus ini, hilangnya trim di
    -- cabang penanda lolos tanpa terdeteksi (terbukti lewat mutasi sumber).
    'https://s.co/storage/v1/object/public/avatars//uid/foto.jpg|avatars|uid/foto.jpg',
    'https://s.co/storage/v1/object/sign/avatars///uid/foto.jpg?token=t|avatars|uid/foto.jpg',
    -- bucket tidak cocok / URL asing -> null
    'https://supabase.carubra.com/storage/v1/object/public/avatars/uid/foto.jpg|gallery|<NULL>',
    'https://cms.carubra.com/uploads/a.jpg|article|<NULL>',
    'https://drive.google.com/file/d/abc/view|daily-report|<NULL>',
    '|avatars|<NULL>',
    '   |avatars|<NULL>'
  ];
  i int;
  masukan text;
  bucket text;
  harapan text;
  hasil text;
  gagal text := '';
begin
  for i in 1 .. array_length(kasus, 1)
  loop
    -- `split_part` dipakai, bukan array bersarang, supaya satu baris = satu
    -- kasus dan tidak ada NULL di literal array yang perlu ditebak pembaca.
    masukan := split_part(kasus[i], '|', 1);
    bucket  := split_part(kasus[i], '|', 2);
    harapan := nullif(split_part(kasus[i], '|', 3), '<NULL>');

    hasil := utero_academy.b03b_to_object_path(masukan, bucket);

    if hasil is distinct from harapan then
      gagal := gagal || format(
        E'\n  masukan=%L bucket=%L -> %L (harusnya %L)',
        masukan, bucket, hasil, harapan);
    end if;
  end loop;

  -- Idempotensi diuji terpisah: hasil pemangkasan, dipangkas lagi, harus sama.
  -- Inilah yang membuat berkas ini aman diulang.
  hasil := utero_academy.b03b_to_object_path(
    'https://supabase.carubra.com/storage/v1/object/public/avatars/uid/surat%20sakit.pdf',
    'avatars');
  if utero_academy.b03b_to_object_path(hasil, 'avatars') is distinct from hasil then
    gagal := gagal || format(E'\n  tidak idempoten: %L', hasil);
  end if;

  -- Dekoder multi-byte: kalau byte-nya dikonversi satu per satu, `’` rusak.
  -- Diuji karena nama unggahan dari macOS/Word memang memuat karakter ini.
  if utero_academy.b03b_percent_decode('surat%E2%80%99s.pdf') is distinct from 'surat’s.pdf' then
    gagal := gagal || E'\n  dekode multi-byte rusak';
  end if;

  if gagal <> '' then
    raise exception
      'Uji pemangkas GAGAL. Backfill dibatalkan tanpa menyentuh satu baris pun:%',
      gagal;
  end if;

  raise notice 'Uji pemangkas lolos (% kasus + idempotensi + multi-byte).',
    array_length(kasus, 1);
end
$$;

-- ---------------------------------------------------------------------------
-- (4) Snapshot + UPDATE, satu putaran per (tabel, kolom, bucket).
--
-- Digerakkan tabel pemetaan, bukan 16 pasang pernyataan yang ditulis tangan:
-- satu salah-tempel nama bucket berarti path ditulis dengan bucket keliru, dan
-- akibatnya 404 yang baru terlihat jauh setelahnya.
--
-- Penjaga `information_schema` per kolom: produksi sudah terbukti menyimpang
-- dari berkas migrasi (lihat "Masalah penyimpangan produksi" di plan), jadi satu
-- kolom yang belum ada tidak boleh membatalkan seluruh backfill -- cukup
-- dilewati dengan `raise warning` yang terlihat operator.
do $$
declare
  peta text[] := array[
    -- tabel | kolom | bucket
    'attendances|check_in_selfie_path|avatars',
    'attendances|check_out_selfie_path|avatars',
    'attendances|out_of_range_proof_path|avatars',
    'attendances|sick_certificate_path|avatars',
    'permits|attachment_path|avatars',
    'user_profiles|avatar_path|avatars',
    'internship_applications|cv_path|avatars',
    'internship_applications|portfolio_path|avatars',
    'attendance_settings|certificate_template_path|avatars',
    'daily_report_attachments|file_path|daily-report',
    'task_attachments|file_path|task',
    'assignment_submissions|attachment_path|learning',
    'articles|cover_path|article',
    'testimonials|photo_path|gallery',
    'galleries|image_path|gallery',
    'landing_page_settings|hero_image_path|gallery'
  ];
  i int;
  tabel text;
  kolom text;
  bucket text;
  syarat_tambahan text;
  jumlah_snapshot bigint;
  jumlah_update bigint;
  total_update bigint := 0;
begin
  for i in 1 .. array_length(peta, 1)
  loop
    tabel  := split_part(peta[i], '|', 1);
    kolom  := split_part(peta[i], '|', 2);
    bucket := split_part(peta[i], '|', 3);

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'utero_academy'
        and table_name = tabel
        and column_name = kolom
    ) then
      raise warning 'DILEWATI (kolom tidak ada di produksi): %.%', tabel, kolom;
      continue;
    end if;

    -- Pengecualian Google Drive. `mime_type = 'url'` menandai baris yang
    -- menyimpan tautan, bukan objek storage. Pemangkas sebenarnya sudah
    -- mengembalikan null untuk domain asing, tapi syaratnya ditulis di sini
    -- juga supaya maksudnya terbaca di query-nya sendiri dan tidak bergantung
    -- pada perilaku fungsi yang bisa berubah.
    if tabel = 'daily_report_attachments' then
      syarat_tambahan := ' and coalesce(mime_type, '''') <> ''url''';
    else
      syarat_tambahan := '';
    end if;

    -- Snapshot lebih dulu, dan hanya baris yang benar-benar akan berubah:
    -- nilainya diawali 'http' DAN pemangkasnya menghasilkan sesuatu. Baris yang
    -- pemangkasnya kembalikan null (URL beda bucket) tidak masuk snapshot
    -- karena ia juga tidak akan di-update.
    --
    -- `id::text`: tipe kunci primernya uuid di sebagian tabel, jadi snapshot
    -- menyimpannya sebagai text supaya satu tabel cukup untuk semuanya.
    execute format(
      'insert into utero_academy.storage_path_backfill_snapshot '
      '  (nama_tabel, nama_kolom, id_baris, nilai_lama) '
      'select %L, %L, id::text, %I from utero_academy.%I '
      'where %I like ''http%%'' '
      '  and utero_academy.b03b_to_object_path(%I, %L) is not null%s',
      tabel, kolom, kolom, tabel, kolom, kolom, bucket, syarat_tambahan);
    get diagnostics jumlah_snapshot = row_count;

    execute format(
      'update utero_academy.%I '
      'set %I = utero_academy.b03b_to_object_path(%I, %L) '
      'where %I like ''http%%'' '
      '  and utero_academy.b03b_to_object_path(%I, %L) is not null%s',
      tabel, kolom, kolom, bucket, kolom, kolom, bucket, syarat_tambahan);
    get diagnostics jumlah_update = row_count;

    if jumlah_snapshot <> jumlah_update then
      -- Tidak boleh terjadi: kedua pernyataan memakai predikat identik. Kalau
      -- berbeda, ada baris yang berubah tanpa salinan pemulihan -- batalkan.
      raise exception
        'Snapshot (%) tidak sama dengan update (%) pada %.%. '
        'Ada baris yang akan berubah tanpa salinan pemulihan. Dibatalkan.',
        jumlah_snapshot, jumlah_update, tabel, kolom;
    end if;

    total_update := total_update + jumlah_update;
    raise notice 'OK %.% (bucket %): % baris', tabel, kolom, bucket, jumlah_update;
  end loop;

  raise notice 'Subtotal kolom skalar: % baris', total_update;
end
$$;

-- ---------------------------------------------------------------------------
-- (4b) lessons.attachments -- JSONB, ditangani terpisah.
--
-- Bentuknya array objek `[{id, name, path, size, type, uploaded_at}]`
-- (0018_lms_rich_content_and_attachments.sql:10,14). Yang dipangkas hanya kunci
-- `path`; kunci lain tidak disentuh.
--
-- Snapshot menyimpan seluruh nilai JSONB baris itu sebagai text, bukan per
-- elemen: pemulihannya harus mengembalikan array utuh, bukan menambal satu
-- elemen di dalam array yang mungkin sudah berubah urutannya.
do $$
declare
  jumlah_snapshot bigint;
  jumlah_update bigint;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'utero_academy'
      and table_name = 'lessons'
      and column_name = 'attachments'
  ) then
    raise warning 'DILEWATI (kolom tidak ada di produksi): lessons.attachments';
    return;
  end if;

  insert into utero_academy.storage_path_backfill_snapshot
    (nama_tabel, nama_kolom, id_baris, nilai_lama)
  select 'lessons', 'attachments', l.id::text, l.attachments::text
  from utero_academy.lessons l
  where l.attachments is not null
    and jsonb_typeof(l.attachments) = 'array'
    and exists (
      select 1 from jsonb_array_elements(l.attachments) e
      where jsonb_typeof(e) = 'object'
        and e->>'path' like 'http%'
        and utero_academy.b03b_to_object_path(e->>'path', 'learning') is not null
    );
  get diagnostics jumlah_snapshot = row_count;

  -- Array disusun ulang elemen demi elemen. `jsonb_set` dengan indeks numerik
  -- tidak dipakai karena indeksnya harus dihitung terpisah; `with ordinality`
  -- + `order by` menjaga urutan aslinya, yang penting karena urutan lampiran
  -- itulah yang dirender ke peserta.
  --
  -- `jsonb_typeof(...) = 'object'` bukan kehati-hatian berlebihan: `jsonb_set`
  -- atas elemen non-objek melempar, dan JSONB ini tak punya constraint bentuk.
  update utero_academy.lessons l
  set attachments = sub.baru
  from (
    select
      l2.id,
      (
        select jsonb_agg(
                 case
                   when jsonb_typeof(e.nilai) = 'object'
                     and utero_academy.b03b_to_object_path(e.nilai->>'path', 'learning') is not null
                   then jsonb_set(
                          e.nilai, '{path}',
                          to_jsonb(utero_academy.b03b_to_object_path(e.nilai->>'path', 'learning')))
                   else e.nilai
                 end
                 order by e.urutan)
        from jsonb_array_elements(l2.attachments) with ordinality as e(nilai, urutan)
      ) as baru
    from utero_academy.lessons l2
    where l2.attachments is not null
      and jsonb_typeof(l2.attachments) = 'array'
      and exists (
        select 1 from jsonb_array_elements(l2.attachments) e
        where jsonb_typeof(e) = 'object'
          and e->>'path' like 'http%'
          and utero_academy.b03b_to_object_path(e->>'path', 'learning') is not null
      )
  ) sub
  where l.id = sub.id;
  get diagnostics jumlah_update = row_count;

  if jumlah_snapshot <> jumlah_update then
    raise exception
      'Snapshot (%) tidak sama dengan update (%) pada lessons.attachments. Dibatalkan.',
      jumlah_snapshot, jumlah_update;
  end if;

  raise notice 'OK lessons.attachments (bucket learning): % baris', jumlah_update;
end
$$;

-- ---------------------------------------------------------------------------
-- (5) Asersi akhir: tidak ada kolom storage yang masih menyimpan URL.
--
-- Ini prasyarat B0.3c dan palang pengaman `0032b`, jadi lebih baik gagal di
-- sini -- di dalam transaksi yang masih bisa dibatalkan -- daripada baru
-- terlihat setelah bucket diprivatkan dan gambar menghilang dari produksi.
--
-- Arah kegagalannya disengaja: `raise exception` membatalkan seluruh backfill.
-- Gagal-palsu memakan waktu penyelidikan; lolos-palsu memakan produksi.
--
-- Dua kolom **dikecualikan** karena URL di sana sah dan bukan objek storage:
--   - `daily_report_attachments.file_path` saat `mime_type = 'url'` (Google Drive)
--   - `articles.cover_path` (instance CMS terpisah `cms.carubra.com`; titik
--     bacanya sudah bercabang di app/(public)/blog/[slug]/page.tsx)
--
-- `lessons.attachments` diperiksa dengan predikat JSONB-nya sendiri, bukan
-- `like 'http%'` atas seluruh kolom -- seluruh kolomnya diawali `[`.
do $$
declare
  peta text[] := array[
    'attendances|check_in_selfie_path',
    'attendances|check_out_selfie_path',
    'attendances|out_of_range_proof_path',
    'attendances|sick_certificate_path',
    'permits|attachment_path',
    'user_profiles|avatar_path',
    'internship_applications|cv_path',
    'internship_applications|portfolio_path',
    'attendance_settings|certificate_template_path',
    'task_attachments|file_path',
    'assignment_submissions|attachment_path',
    'testimonials|photo_path',
    'galleries|image_path',
    'landing_page_settings|hero_image_path'
  ];
  i int;
  tabel text;
  kolom text;
  sisa bigint;
  total bigint := 0;
  rincian text := '';
begin
  for i in 1 .. array_length(peta, 1)
  loop
    tabel := split_part(peta[i], '|', 1);
    kolom := split_part(peta[i], '|', 2);

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'utero_academy'
        and table_name = tabel
        and column_name = kolom
    ) then
      continue;
    end if;

    execute format(
      'select count(*) from utero_academy.%I where %I like ''http%%''',
      tabel, kolom) into sisa;

    if sisa > 0 then
      total := total + sisa;
      rincian := rincian || format('%s.%s=%s ', tabel, kolom, sisa);
    end if;
  end loop;

  -- daily_report_attachments: hanya baris yang BUKAN tautan yang dihitung.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'utero_academy'
      and table_name = 'daily_report_attachments'
      and column_name = 'file_path'
  ) then
    select count(*) into sisa
    from utero_academy.daily_report_attachments
    where file_path like 'http%'
      and coalesce(mime_type, '') <> 'url';

    if sisa > 0 then
      total := total + sisa;
      rincian := rincian || format('daily_report_attachments.file_path=%s ', sisa);
    end if;
  end if;

  -- lessons.attachments: hanya elemen yang path-nya masih URL.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'utero_academy'
      and table_name = 'lessons'
      and column_name = 'attachments'
  ) then
    select count(*) into sisa
    from utero_academy.lessons l
    where l.attachments is not null
      and jsonb_typeof(l.attachments) = 'array'
      and exists (
        select 1 from jsonb_array_elements(l.attachments) e
        where jsonb_typeof(e) = 'object'
          and e->>'path' like 'http%'
      );

    if sisa > 0 then
      total := total + sisa;
      rincian := rincian || format('lessons.attachments=%s ', sisa);
    end if;
  end if;

  if total > 0 then
    raise exception
      'Masih ada % nilai menyimpan URL setelah backfill (%). '
      'Penyebab paling mungkin: bucket sebenarnya berbeda dari peta, sehingga '
      'pemangkas mengembalikan null dan barisnya dilewati. Periksa nilainya '
      'satu per satu. JANGAN lanjut ke 0032b. Seluruh backfill dibatalkan.',
      total, btrim(rincian);
  end if;

  raise notice
    'Asersi lolos: tidak ada kolom storage yang masih menyimpan URL penuh.';
end
$$;

-- ---------------------------------------------------------------------------
-- (6) Fungsi bantu dibuang.
--
-- Keduanya alat sekali pakai. Meninggalkannya berarti ada fungsi di skema
-- produksi yang tidak dipanggil apa pun -- dan fungsi yatim nanti dibaca orang
-- sebagai bagian dari desain, lalu dipakai lagi.
--
-- Tabel snapshot TIDAK dibuang. Ia satu-satunya jalan pulih, dan baru boleh
-- dihapus setelah B0.3c lolos dan berkas-berkas terbukti masih terbuka.
drop function if exists utero_academy.b03b_to_object_path(text, text);
drop function if exists utero_academy.b03b_percent_decode(text);

commit;

-- ---------------------------------------------------------------------------
-- Setelah commit: lihat apa yang berubah.
--
--   select nama_tabel, nama_kolom, count(*)
--   from utero_academy.storage_path_backfill_snapshot
--   group by 1, 2 order by 1, 2;
--
-- Cara memulihkan satu kolom kalau ternyata salah (contoh):
--
--   update utero_academy.attendances a
--   set check_in_selfie_path = s.nilai_lama
--   from utero_academy.storage_path_backfill_snapshot s
--   where s.nama_tabel = 'attendances'
--     and s.nama_kolom = 'check_in_selfie_path'
--     and a.id::text = s.id_baris;
--
-- Pemulihan lessons.attachments memakai kolom yang sama, dengan cast jsonb:
--
--   update utero_academy.lessons l
--   set attachments = s.nilai_lama::jsonb
--   from utero_academy.storage_path_backfill_snapshot s
--   where s.nama_tabel = 'lessons'
--     and s.nama_kolom = 'attachments'
--     and l.id::text = s.id_baris;
