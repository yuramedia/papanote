import { db } from '../db/client.ts';
import { supabaseAdmin } from '../supabase.ts';
import { SYNC_TABLES, upsertRow, type Row, type SyncTable } from '../sync.ts';

const PAGE = 1000;
/** Kolom cursor per tabel. card_histories immutable → pakai created_at. */
const CURSOR_COL: Record<SyncTable, string> = {
  boards: 'updated_at',
  lists: 'updated_at',
  cards: 'updated_at',
  card_histories: 'created_at',
  push_subscriptions: 'created_at',
};
/** Urutan penting agar parent tersinkron lebih dulu. */
const ORDER: SyncTable[] = ['boards', 'lists', 'cards', 'card_histories', 'push_subscriptions'];

/**
 * Tarik baris yang berubah sejak cursor terakhir dari Supabase → upsert ke internal.
 * Menutup celah webhook yang hilang (pg_net fire-and-forget).
 */
export async function reconcile(): Promise<Record<string, number>> {
  const sql = db();
  const sb = supabaseAdmin();
  const result: Record<string, number> = {};

  for (const table of ORDER) {
    const col = CURSOR_COL[table];
    const [state] = await sql`SELECT cursor FROM sync_state WHERE key = ${table}`;
    let cursor: string = state ? new Date(state.cursor).toISOString() : '1970-01-01T00:00:00Z';
    let count = 0;

    for (;;) {
      // gte (bukan gt) agar baris dengan timestamp identik di batas halaman tidak terlewat;
      // upsert bersifat idempoten jadi duplikat aman.
      const { data, error } = await sb
        .from(table)
        .select(SYNC_TABLES[table].join(','))
        .gte(col, cursor)
        .order(col, { ascending: true })
        .limit(PAGE);
      if (error) throw new Error(`[reconcile] ${table}: ${error.message}`);
      const rows = (data ?? []) as unknown as Row[];
      for (const row of rows) await upsertRow(sql, table, row);
      count += rows.length;

      const last = rows.at(-1)?.[col] as string | undefined;
      if (last) {
        await sql`INSERT INTO sync_state (key, cursor) VALUES (${table}, ${last})
                  ON CONFLICT (key) DO UPDATE SET cursor = EXCLUDED.cursor`;
      }
      // Berhenti jika halaman tidak penuh atau cursor tidak maju (semua baris bertimestamp sama).
      if (rows.length < PAGE || !last || last === cursor) break;
      cursor = last;
    }
    result[table] = count;
  }
  return result;
}
