import { db } from '../db/client.ts';
import { env } from '../env.ts';
import { supabaseAdmin } from '../supabase.ts';
import { reconcile } from './reconcile.ts';

const DAY = 24 * 60 * 60 * 1000;
const BATCH = 500;

type Purgeable = 'boards' | 'lists' | 'cards' | 'card_histories';

interface Candidate {
  id: string;
  updated_at?: string;
}

/**
 * Pilih kandidat yang AMAN dihapus dari cache: hanya yang sudah ada di internal
 * dan (untuk tabel versioned) versi internal tidak lebih lama dari versi Supabase.
 */
export function selectVerified(
  candidates: Candidate[],
  internal: Map<string, string | null>,
): string[] {
  return candidates
    .filter((c) => {
      if (!internal.has(c.id)) return false;
      if (!c.updated_at) return true;
      const internalUpdated = internal.get(c.id);
      return internalUpdated != null && new Date(internalUpdated) >= new Date(c.updated_at);
    })
    .map((c) => c.id);
}

async function purgeTable(
  table: Purgeable,
  column: 'deleted_at' | 'created_at',
  cutoff: Date,
): Promise<number> {
  const sb = supabaseAdmin();
  const sql = db();
  const versioned = table !== 'card_histories';
  let total = 0;

  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select(versioned ? 'id,updated_at' : 'id')
      .lt(column, cutoff.toISOString())
      .limit(BATCH);
    if (error) throw new Error(`[cleanup] ${table}: ${error.message}`);
    const candidates = (data ?? []) as unknown as Candidate[];
    if (candidates.length === 0) break;

    const ids = candidates.map((c) => c.id);
    const rows: { id: string; updated_at: Date | null }[] = versioned
      ? await sql.unsafe(`SELECT id::text, updated_at FROM "${table}" WHERE id = ANY($1::uuid[])`, [ids])
      : await sql.unsafe(`SELECT id::text, NULL AS updated_at FROM "${table}" WHERE id = ANY($1::uuid[])`, [ids]);
    const internal = new Map(
      rows.map((r) => [r.id, r.updated_at ? new Date(r.updated_at).toISOString() : null]),
    );
    const safe = selectVerified(candidates, internal);
    if (safe.length > 0) {
      const { error: delErr } = await sb.from(table).delete().in('id', safe);
      if (delErr) throw new Error(`[cleanup] delete ${table}: ${delErr.message}`);
      total += safe.length;
    }
    // Ada kandidat yang belum tersinkron → hentikan agar tidak loop tanpa akhir; dicoba lagi besok.
    if (safe.length < candidates.length || candidates.length < BATCH) break;
  }
  return total;
}

/**
 * Pembersihan harian:
 * 1. Rekonsiliasi dulu agar semua data terbaru sudah ada di internal.
 * 2. Supabase: hapus riwayat > HISTORY_RETENTION_DAYS dan board/list/kartu
 *    soft-deleted > DELETED_CARD_GRACE_DAYS (hanya yang terverifikasi ada di internal).
 * 3. Internal: hapus riwayat > HISTORY_RETENTION_DAYS_INTERNAL (0 = simpan selamanya).
 */
export async function cleanup(now = new Date()): Promise<Record<string, number>> {
  await reconcile();

  const historyCutoff = new Date(now.getTime() - env.historyRetentionDays * DAY);
  const deletedCutoff = new Date(now.getTime() - env.deletedCardGraceDays * DAY);

  const result: Record<string, number> = {
    card_histories: await purgeTable('card_histories', 'created_at', historyCutoff),
    cards: await purgeTable('cards', 'deleted_at', deletedCutoff),
    lists: await purgeTable('lists', 'deleted_at', deletedCutoff),
    boards: await purgeTable('boards', 'deleted_at', deletedCutoff),
  };

  if (env.historyRetentionDaysInternal > 0) {
    const internalCutoff = new Date(now.getTime() - env.historyRetentionDaysInternal * DAY);
    const deleted = await db()`DELETE FROM card_histories WHERE created_at < ${internalCutoff} RETURNING id`;
    result.internal_card_histories = deleted.length;
  }
  // Log notifikasi lama tidak berguna lagi
  await db()`DELETE FROM notification_log WHERE deadline < ${new Date(now.getTime() - 7 * DAY)}`;
  return result;
}
