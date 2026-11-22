alter table utero_academy.internship_applications
  add column if not exists school_letter_path text,
  add column if not exists proposal_path text,
  add column if not exists photo_path text;
