-- =====================================================================
-- papanote — PostgreSQL internal (Source of Truth)
-- Dijalankan otomatis oleh server saat start (server/db/migrate.ts).
-- Tidak ada FK ke auth.users karena Auth hidup di Supabase.
-- =====================================================================

CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  position DOUBLE PRECISION NOT NULL,
  created_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL,
  title TEXT NOT NULL,
  position DOUBLE PRECISION NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY,
  list_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  position DOUBLE PRECISION NOT NULL,
  deadline_date TIMESTAMPTZ,
  enable_notification BOOLEAN DEFAULT FALSE,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_histories (
  id UUID PRIMARY KEY,
  card_id UUID,
  old_content TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_list_position ON cards(list_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_deadline ON cards(deadline_date)
  WHERE enable_notification = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_histories_created ON card_histories(created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- Dedupe pengingat deadline: satu baris per (kartu, jenis, nilai deadline)
CREATE TABLE IF NOT EXISTS notification_log (
  card_id UUID NOT NULL,
  kind TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, kind, deadline)
);

-- Cursor job rekonsiliasi per tabel
CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  cursor TIMESTAMPTZ NOT NULL
);
