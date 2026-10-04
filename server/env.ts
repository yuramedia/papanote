/** Konfigurasi server dari environment variable. */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: num('PORT', 3000),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  historyRetentionDays: num('HISTORY_RETENTION_DAYS', 30),
  historyRetentionDaysInternal: num('HISTORY_RETENTION_DAYS_INTERNAL', 30),
  deletedCardGraceDays: num('DELETED_CARD_GRACE_DAYS', 7),
  jobsEnabled: (process.env.JOBS_ENABLED ?? 'true') !== 'false',
  distDir: process.env.DIST_DIR ?? 'dist',
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
