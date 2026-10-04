import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from './types';

let config: AppConfig | null = null;
let client: SupabaseClient | null = null;

/** Ambil konfigurasi publik dari server saat runtime (tidak di-bake saat build). */
export async function loadConfig(): Promise<AppConfig> {
  if (config) return config;
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error(`Gagal memuat konfigurasi (${res.status})`);
  config = (await res.json()) as AppConfig;
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
