-- =====================================================================
-- papanote — Supabase (cache / realtime layer)
-- 001: Skema tabel
-- Jalankan di Supabase Dashboard → SQL Editor (berurutan 001 → 003).
-- =====================================================================

CREATE TABLE IF NOT EXISTS boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  position FLOAT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position FLOAT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Utama Kartu Catatan
CREATE TABLE IF NOT EXISTS cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  position FLOAT NOT NULL,
  deadline_date TIMESTAMP WITH TIME ZONE,
  enable_notification BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Riwayat Perubahan Teks
CREATE TABLE IF NOT EXISTS card_histories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  old_content TEXT,
  changed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeks Performa untuk Fitur Drag & Drop Kilat
CREATE INDEX IF NOT EXISTS idx_cards_list_position ON cards(list_id, position);
CREATE INDEX IF NOT EXISTS idx_lists_board_position ON lists(board_id, position);
CREATE INDEX IF NOT EXISTS idx_histories_card ON card_histories(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_histories_created ON card_histories(created_at);
-- Dipakai job rekonsiliasi (tarik baris dengan updated_at > cursor)
CREATE INDEX IF NOT EXISTS idx_boards_updated ON boards(updated_at);
CREATE INDEX IF NOT EXISTS idx_lists_updated ON lists(updated_at);
CREATE INDEX IF NOT EXISTS idx_cards_updated ON cards(updated_at);
