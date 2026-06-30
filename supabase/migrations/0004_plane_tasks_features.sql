-- Migration 0004: Plane Tasks Features (Priority & Subtasks)

-- 1. Tambah kolom priority ke task_cards
ALTER TABLE utero_academy.task_cards 
ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

-- 2. Buat tabel task_subtasks
CREATE TABLE IF NOT EXISTS utero_academy.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES utero_academy.task_cards(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Aktifkan RLS
ALTER TABLE utero_academy.task_subtasks ENABLE ROW LEVEL SECURITY;

-- 4. Berikan hak akses (grant) untuk role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE utero_academy.task_subtasks TO authenticated;

-- 5. Tambahkan RLS policies sederhana (karena bypass server-side service role client aktif, kita pasang policy dasar true agar sinkron)
CREATE POLICY "task_subtasks dapat dibaca user login"
ON utero_academy.task_subtasks
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "task_subtasks dapat dimanipulasi user login"
ON utero_academy.task_subtasks
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
