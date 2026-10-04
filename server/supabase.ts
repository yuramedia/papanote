import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.ts';

let admin: SupabaseClient | null = null;

/** Klien Supabase dengan service role (melewati RLS) — HANYA dipakai di server. */
export function supabaseAdmin(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set');
  }
  admin ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Verifikasi bearer token user (JWT Supabase). Mengembalikan user id atau null. */
export async function authenticate(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
