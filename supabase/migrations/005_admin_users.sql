-- =====================================================================
-- papanote — 005: Fungsi Admin Kelola Pengguna
-- Memungkinkan Admin (admin@yuramedia.com) membuat akun baru langsung
-- dari antarmuka web (UI) secara aman via Supabase RPC.
-- =====================================================================

CREATE OR REPLACE FUNCTION admin_create_user(new_email text, new_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  calling_user_id uuid;
  calling_user_email text;
  new_user_id uuid := gen_random_uuid();
  identity_id uuid := gen_random_uuid();
  encrypted_pw text;
BEGIN
  -- 1. Verifikasi bahwa pemanggil adalah user yang login
  calling_user_id := auth.uid();
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Anda harus login';
  END IF;

  -- 2. Verifikasi bahwa pemanggil adalah Admin
  SELECT email INTO calling_user_email FROM auth.users WHERE id = calling_user_id;
  IF calling_user_email != 'admin@yuramedia.com' THEN
    RAISE EXCEPTION 'Forbidden: Hanya Admin yang dapat membuat akun';
  END IF;

  -- 3. Validasi email & password
  IF new_email IS NULL OR position('@' in new_email) = 0 THEN
    RAISE EXCEPTION 'Format email tidak valid';
  END IF;

  IF new_password IS NULL OR length(new_password) < 6 THEN
    RAISE EXCEPTION 'Password minimal 6 karakter';
  END IF;

  -- Cek apakah email sudah terdaftar
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(new_email)) THEN
    RAISE EXCEPTION 'Email % sudah terdaftar', new_email;
  END IF;

  -- Hash password dengan bcrypt 10 rounds
  encrypted_pw := crypt(new_password, gen_salt('bf', 10));

  -- Insert ke auth.users
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

  -- Insert ke auth.identities
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

  RETURN jsonb_build_object('id', new_user_id, 'email', lower(new_email));
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Anda harus login';
  END IF;

  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'admin@yuramedia.com' THEN
    RAISE EXCEPTION 'Forbidden: Hanya Admin yang memiliki akses';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;
