-- =====================================================================
-- papanote — 006: Sistem Multi-Admin Dinamis
-- Mendukung banyak admin, promosi/pencabutan hak admin langsung dari UI.
-- =====================================================================

CREATE TABLE IF NOT EXISTS app_admins (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inisialisasi admin utama awal
INSERT INTO app_admins (email) VALUES ('admin@yuramedia.com') ON CONFLICT DO NOTHING;

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- Pengguna yang login boleh membaca daftar admin untuk validasi role di UI
DROP POLICY IF EXISTS "app_admins_select" ON app_admins;
CREATE POLICY "app_admins_select" ON app_admins
  FOR SELECT TO authenticated USING (true);

-- Fungsi pembantu untuk memeriksa apakah pemanggil adalah salah satu Admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_admins a
    JOIN auth.users u ON lower(u.email) = lower(a.email)
    WHERE u.id = auth.uid()
  );
$$;

DROP FUNCTION IF EXISTS admin_list_users();
DROP FUNCTION IF EXISTS admin_create_user(text, text);
DROP FUNCTION IF EXISTS admin_create_user(text, text, boolean);

-- Fungsi membuat user baru (dengan opsi make_admin)
CREATE OR REPLACE FUNCTION admin_create_user(
  new_email text,
  new_password text,
  make_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  identity_id uuid := gen_random_uuid();
  encrypted_pw text;
BEGIN
  -- 1. Verifikasi hak akses admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Hanya Admin yang dapat membuat akun';
  END IF;

  -- 2. Validasi input
  IF new_email IS NULL OR position('@' in new_email) = 0 THEN
    RAISE EXCEPTION 'Format email tidak valid';
  END IF;

  IF new_password IS NULL OR length(new_password) < 6 THEN
    RAISE EXCEPTION 'Password minimal 6 karakter';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(new_email)) THEN
    RAISE EXCEPTION 'Email % sudah terdaftar', new_email;
  END IF;

  -- 3. Hash password dengan bcrypt 10 rounds
  encrypted_pw := crypt(new_password, gen_salt('bf', 10));

  -- 4. Simpan ke auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    lower(new_email),
    encrypted_pw,
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    null,
    false,
    false,
    now(),
    now()
  );

  -- 5. Simpan ke auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    identity_id,
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', lower(new_email), 'email_verified', false, 'phone_verified', false),
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );

  -- 6. Daftarkan sebagai admin jika dipilih
  IF make_admin THEN
    INSERT INTO app_admins (email) VALUES (lower(new_email)) ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('id', new_user_id, 'email', lower(new_email), 'is_admin', make_admin);
END;
$$;

-- Fungsi mengambil daftar seluruh user beserta status admin-nya
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Hanya Admin yang memiliki akses';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    EXISTS (SELECT 1 FROM app_admins a WHERE lower(a.email) = lower(u.email)) AS is_admin
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- Fungsi mengatur hak akses admin (promosi / cabut)
CREATE OR REPLACE FUNCTION admin_set_role(target_email text, make_admin boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Hanya Admin yang dapat mengubah role';
  END IF;

  -- Kunci perlindungan akun root agar tidak terkunci keluar
  IF lower(target_email) = 'admin@yuramedia.com' AND NOT make_admin THEN
    RAISE EXCEPTION 'Hak akses root admin (admin@yuramedia.com) tidak dapat dicabut demi keamanan.';
  END IF;

  IF make_admin THEN
    INSERT INTO app_admins (email) VALUES (lower(target_email)) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM app_admins WHERE lower(email) = lower(target_email);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_role(text, boolean) TO authenticated;
