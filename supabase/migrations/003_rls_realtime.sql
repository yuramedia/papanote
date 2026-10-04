-- =====================================================================
-- papanote — 003: Row Level Security & Realtime
-- Kebijakan: semua user yang login (tim internal) boleh melihat & mengedit
-- semua papan. Hapus fisik hanya oleh service role (job purge cache);
-- user "menghapus" dengan mengisi deleted_at (soft-delete).
-- =====================================================================

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_histories ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['boards', 'lists', 'cards'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_update" ON %1$I', t);
    EXECUTE format('CREATE POLICY "%1$s_select" ON %1$I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "%1$s_insert" ON %1$I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "%1$s_update" ON %1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "card_histories_select" ON card_histories;
CREATE POLICY "card_histories_select" ON card_histories
  FOR SELECT TO authenticated USING (true);

-- Realtime: siarkan perubahan ke klien
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE boards; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE lists;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE cards;  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
