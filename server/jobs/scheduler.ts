import { features } from '../env.ts';
import { cleanup } from './cleanup.ts';
import { sendDeadlineReminders } from './deadlines.ts';
import { reconcile } from './reconcile.ts';

const MINUTE = 60_000;

/** Jalankan fn secara berkala tanpa tumpang tindih (run berikutnya menunggu yang sekarang selesai). */
function every(name: string, intervalMs: number, fn: () => Promise<unknown>): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const res = await fn();
      if (res && (typeof res !== 'number' || res > 0)) console.log(`[job:${name}]`, res);
    } catch (err) {
      console.error(`[job:${name}] gagal:`, err);
    } finally {
      running = false;
    }
  };
  setInterval(tick, intervalMs);
  setTimeout(tick, 5_000);
}

/** Milidetik sampai jam:menit berikutnya (zona Asia/Jakarta, UTC+7). */
function msUntilWib(hour: number, minute = 0): number {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(hour - 7, minute, 0, 0);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

export function startJobs(): void {
  if (!features.internalDb) {
    console.warn('[jobs] DATABASE_URL kosong → job dinonaktifkan');
    return;
  }
  if (features.supabaseAdmin) {
    every('reconcile', 5 * MINUTE, reconcile);
    const scheduleCleanup = () =>
      setTimeout(async () => {
        try {
          console.log('[job:cleanup]', await cleanup());
        } catch (err) {
          console.error('[job:cleanup] gagal:', err);
        }
        scheduleCleanup();
      }, msUntilWib(3));
    scheduleCleanup();
  } else {
    console.warn('[jobs] SUPABASE_SERVICE_ROLE_KEY kosong → rekonsiliasi & cleanup dinonaktifkan');
  }
  if (features.push) {
    every('deadlines', MINUTE, () => sendDeadlineReminders());
  } else {
    console.warn('[jobs] VAPID key kosong → pengingat deadline dinonaktifkan');
  }
}
