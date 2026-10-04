import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from './client.ts';

const MIGRATIONS_DIR = join(import.meta.dir, 'migrations');

/** Runner migrasi sederhana: tiap file .sql dijalankan sekali, dicatat di _migrations. */
export async function migrate(): Promise<void> {
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  const applied = new Set(
    (await sql`SELECT name FROM _migrations`).map((r: { name: string }) => r.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const content = await Bun.file(join(MIGRATIONS_DIR, file)).text();
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });
    console.log(`[migrate] applied ${file}`);
  }
}
