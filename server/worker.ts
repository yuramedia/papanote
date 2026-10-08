import { env, features } from './env.ts';
import { migrate } from './db/migrate.ts';
import { startJobs } from './jobs/scheduler.ts';

console.log('[worker] memulai papanote background sync worker...');

if (features.internalDb) {
  await migrate();
  console.log('[worker] migrasi PostgreSQL internal selesai.');
} else {
  console.warn('[worker] DATABASE_URL belum di-set → sinkronisasi database internal tidak aktif');
}

if (env.jobsEnabled) {
  startJobs();
  console.log('[worker] scheduler job pull sync, deadlines, dan cleanup telah aktif.');
} else {
  console.log('[worker] JOBS_ENABLED=false → job scheduler dinonaktifkan.');
}

// Menjaga worker process tetap hidup
setInterval(() => {}, 1 << 30);
