import { SQL } from 'bun';
import { env } from '../env.ts';

let instance: SQL | null = null;

/** Koneksi ke PostgreSQL internal (source of truth). */
export function db(): SQL {
  if (!env.databaseUrl) throw new Error('DATABASE_URL belum di-set');
  instance ??= new SQL(env.databaseUrl, { max: 10, idleTimeout: 30 });
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
