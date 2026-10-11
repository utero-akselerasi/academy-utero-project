-- Jalankan hanya setelah memverifikasi target dan menyelesaikan migrasi sebelumnya.
-- Tidak mem-backfill PII dari sumber lain; peserta mengisinya sendiri.
alter table utero_academy.intern_profiles
  add column if not exists school_name text,
  add column if not exists address text,
  add column if not exists school_supervisor_name text,
  add column if not exists school_supervisor_phone text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

-- RLS mengatur baris, bukan kolom status, school_id, dan tanggal magang.
revoke update on table utero_academy.intern_profiles from authenticated;
revoke update on table utero_academy.user_profiles from authenticated;
grant update (full_name, phone, avatar_path, updated_at) on utero_academy.user_profiles to authenticated;

create or replace function utero_academy.update_own_intern_biodata(
  p_full_name text, p_phone text, p_major text, p_grade_or_semester text,
  p_school_name text, p_address text, p_school_supervisor_name text,
  p_school_supervisor_phone text, p_emergency_contact_name text,
  p_emergency_contact_phone text, p_avatar_path text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autentikasi diperlukan'; end if;
  if nullif(btrim(p_full_name), '') is null or nullif(btrim(p_phone), '') is null
     or nullif(btrim(p_major), '') is null or nullif(btrim(p_grade_or_semester), '') is null
     or nullif(btrim(p_school_name), '') is null or nullif(btrim(p_address), '') is null
     or nullif(btrim(p_school_supervisor_name), '') is null
     or nullif(btrim(p_school_supervisor_phone), '') is null then
    raise exception 'Biodata wajib belum lengkap';
  end if;
  if (p_emergency_contact_name is null) <> (p_emergency_contact_phone is null) then
    raise exception 'Kontak darurat harus memiliki nama dan nomor';
  end if;
  if p_avatar_path is not null and p_avatar_path !~
     ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$') then
    raise exception 'Path avatar tidak valid';
  end if;
  update utero_academy.intern_profiles
     set full_name = btrim(p_full_name),
         email = (select u.email from auth.users u where u.id = auth.uid()),
         phone = btrim(p_phone), major = btrim(p_major),
         grade_or_semester = btrim(p_grade_or_semester), school_name = btrim(p_school_name),
         address = btrim(p_address), school_supervisor_name = btrim(p_school_supervisor_name),
         school_supervisor_phone = btrim(p_school_supervisor_phone),
         emergency_contact_name = p_emergency_contact_name,
         emergency_contact_phone = p_emergency_contact_phone, updated_at = now()
   where user_id = auth.uid();
  if not found then raise exception 'Profil peserta tidak ditemukan'; end if;
  update utero_academy.user_profiles
     set full_name = btrim(p_full_name), phone = btrim(p_phone),
         avatar_path = coalesce(p_avatar_path, avatar_path), updated_at = now()
   where id = auth.uid();
  if not found then raise exception 'Profil utama tidak ditemukan'; end if;
end;
$$;

revoke all on function utero_academy.update_own_intern_biodata(text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function utero_academy.update_own_intern_biodata(text,text,text,text,text,text,text,text,text,text,text) to authenticated;
