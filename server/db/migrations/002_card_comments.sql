-- =====================================================================
-- papanote — PostgreSQL internal
-- 002: Tabel card_comments
-- =====================================================================

CREATE TABLE IF NOT EXISTS card_comments (
  id UUID PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT NOT NULL,
  user_email TEXT,
  content TEXT NOT NULL,
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_card ON card_comments(card_id, created_at ASC);
