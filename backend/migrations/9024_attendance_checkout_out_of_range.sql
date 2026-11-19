alter table utero_academy.attendances
  add column if not exists check_out_is_out_of_range boolean not null default false,
  add column if not exists check_out_out_of_range_reason text,
  add column if not exists check_out_out_of_range_proof_path text;
