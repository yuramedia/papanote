-- =====================================================================
-- papanote — 002: Trigger updated_at & Version History
-- =====================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_boards_updated_at ON boards;
CREATE TRIGGER trg_boards_updated_at BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lists_updated_at ON lists;
CREATE TRIGGER trg_lists_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cards_updated_at ON cards;
CREATE TRIGGER trg_cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Version history: salin konten lama ke card_histories SEBELUM konten utama diperbarui.
-- SECURITY DEFINER agar insert tetap jalan walau user tidak punya policy INSERT di card_histories.
CREATE OR REPLACE FUNCTION archive_card_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    INSERT INTO card_histories (card_id, old_content, changed_by)
    VALUES (OLD.id, OLD.content, NEW.updated_by);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_card_history ON cards;
CREATE TRIGGER trg_card_history BEFORE UPDATE OF content ON cards
  FOR EACH ROW EXECUTE FUNCTION archive_card_content();
