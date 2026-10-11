-- =====================================================================
-- papanote — 007: Fitur Akses & Visibilitas Papan (Board Visibility)
-- Menambahkan kolom visibilitas (public, private, members) dan member_ids.
-- Menyediakan RPC get_team_members() agar semua anggota tim dapat
-- memilih rekan tim untuk kolaborasi di papan.
-- Jalankan file ini di Supabase Dashboard → SQL Editor.
-- =====================================================================

-- 1. Tambah kolom visibility, member_ids, dan member_roles ke tabel boards jika belum ada
ALTER TABLE boards ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS member_ids TEXT[] DEFAULT '{}';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS member_roles JSONB DEFAULT '{}'::jsonb;

-- 2. Tambah check constraint untuk nilai visibility yang valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'boards_visibility_check'
  ) THEN
    ALTER TABLE boards ADD CONSTRAINT boards_visibility_check
      CHECK (visibility IN ('public', 'private', 'members'));
  END IF;
END $$;

-- 3. Fungsi pembantu untuk mengambil daftar email, ID, dan username anggota tim
-- Dapat dipanggil oleh setiap user yang telah login (authenticated)
-- untuk keperluan memilih rekan tim saat mengatur akses papan.
DROP FUNCTION IF EXISTS get_team_members();
CREATE OR REPLACE FUNCTION get_team_members()
RETURNS TABLE (
  id uuid,
  email text,
  username text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT 
    u.id, 
    u.email::text,
    coalesce(nullif(u.raw_user_meta_data->>'username', ''), split_part(u.email::text, '@', 1))::text as username
  FROM auth.users u
  WHERE auth.uid() IS NOT NULL
  ORDER BY u.email ASC;
$$;

GRANT EXECUTE ON FUNCTION get_team_members() TO authenticated;

-- 4. Perbarui Kebijakan Row Level Security (RLS) pada tabel boards
-- Hanya board yang berstatus public, atau milik pembuatnya, atau admin,
-- atau user yang terdaftar di member_ids (via user ID, email, atau username) yang boleh dibaca.
DROP POLICY IF EXISTS "boards_select" ON boards;
CREATE POLICY "boards_select" ON boards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      visibility = 'public'
      OR created_by = auth.uid()
      OR is_admin()
      OR auth.uid()::text = ANY(member_ids)
      OR lower(coalesce(auth.jwt()->>'email', '')) = ANY(member_ids)
      OR split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 1) = ANY(member_ids)
      OR concat('@', split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 1)) = ANY(member_ids)
      OR lower(coalesce(auth.jwt()->'user_metadata'->>'username', '')) = ANY(member_ids)
      OR concat('@', lower(coalesce(auth.jwt()->'user_metadata'->>'username', ''))) = ANY(member_ids)
    )
  );

-- Pengguna boleh memperbarui papan miliknya sendiri atau jika merupakan Admin
-- atau anggota yang terdaftar di member_ids (via ID, email, atau username)
DROP POLICY IF EXISTS "boards_update" ON boards;
CREATE POLICY "boards_update" ON boards
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR is_admin()
    OR auth.uid()::text = ANY(member_ids)
    OR lower(coalesce(auth.jwt()->>'email', '')) = ANY(member_ids)
    OR split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 1) = ANY(member_ids)
    OR concat('@', split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 1)) = ANY(member_ids)
    OR lower(coalesce(auth.jwt()->'user_metadata'->>'username', '')) = ANY(member_ids)
    OR concat('@', lower(coalesce(auth.jwt()->'user_metadata'->>'username', ''))) = ANY(member_ids)
  )
  WITH CHECK (true);
