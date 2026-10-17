-- =====================================================================
-- papanote — Supabase
-- 008: Tabel Komentar & Diskusi Kartu (@mentions & reactions)
-- =====================================================================

CREATE TABLE IF NOT EXISTS card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  content TEXT NOT NULL,
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comments_card ON card_comments(card_id, created_at ASC);

-- Publikasikan ke Realtime Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE card_comments;

-- RLS (Row Level Security)
ALTER TABLE card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Semua user terotentikasi dapat melihat komentar"
  ON card_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "User dapat menambah komentar"
  ON card_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Pembuat komentar atau admin dapat mengubah komentar"
  ON card_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Pembuat komentar atau admin dapat menghapus komentar"
  ON card_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');
