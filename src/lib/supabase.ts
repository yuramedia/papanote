import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from './types';

let config: AppConfig | null = null;
let client: SupabaseClient | null = null;

/** Ambil konfigurasi publik statis (dari /config.json atau import.meta.env). */
export async function loadConfig(): Promise<AppConfig> {
  if (config) return config;
  try {
    const res = await fetch('/config.json', { cache: 'no-cache' });
    if (res.ok) {
      config = (await res.json()) as AppConfig;
      return config;
    }
  } catch {
    // fallback jika config.json tidak ada atau gagal
  }

  // Fallback ke Vite environment variables jika ada saat build
  config = {
    supabaseUrl: (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey: (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY ?? '',
    vapidPublicKey: (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_VAPID_PUBLIC_KEY ?? '',
  };
  return config;
}

export function getConfig(): AppConfig {
  if (!config) throw new Error('Konfigurasi belum dimuat');
  return config;
}

export function isConfigured(c: AppConfig): boolean {
  return Boolean(c.supabaseUrl && c.supabaseAnonKey);
}

export function supabase(): SupabaseClient {
  if (!client) {
    const c = getConfig();
    client = createClient(c.supabaseUrl, c.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}
