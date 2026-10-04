/** Konfigurasi server dari environment variable. */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  get port() { return num('PORT', 3000); },
  get supabaseUrl() { return process.env.SUPABASE_URL ?? ''; },
  get supabaseAnonKey() { return process.env.SUPABASE_ANON_KEY ?? ''; },
  get supabaseServiceRoleKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ''; },
  get webhookSecret() { return process.env.WEBHOOK_SECRET ?? ''; },
  get vapidPublicKey() { return process.env.VAPID_PUBLIC_KEY ?? ''; },
  get vapidPrivateKey() { return process.env.VAPID_PRIVATE_KEY ?? ''; },
  get vapidSubject() { return process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'; },
  get historyRetentionDays() { return num('HISTORY_RETENTION_DAYS', 30); },
  get historyRetentionDaysInternal() { return num('HISTORY_RETENTION_DAYS_INTERNAL', 30); },
  get deletedCardGraceDays() { return num('DELETED_CARD_GRACE_DAYS', 7); },
  get jobsEnabled() { return (process.env.JOBS_ENABLED ?? 'true') !== 'false'; },
  get distDir() { return process.env.DIST_DIR ?? 'dist'; },
};

export const features = {
  get internalDb() {
    return env.databaseUrl !== '';
  },
  get supabaseAdmin() {
    return env.supabaseUrl !== '' && env.supabaseServiceRoleKey !== '';
  },
  get push() {
    return env.vapidPublicKey !== '' && env.vapidPrivateKey !== '';
  },
};
