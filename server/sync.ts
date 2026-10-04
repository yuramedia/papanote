import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Whitelist tabel & kolom yang boleh disinkronkan dari Supabase ke Postgres internal.
 * Payload webhook tidak pernah dipercaya mentah-mentah.
 */
export const SYNC_TABLES = {
  boards: ['id', 'title', 'position', 'created_by', 'deleted_at', 'created_at', 'updated_at'],
  lists: ['id', 'board_id', 'title', 'position', 'deleted_at', 'created_at', 'updated_at'],
  cards: [
    'id', 'list_id', 'title', 'content', 'position', 'deadline_date', 'enable_notification',
    'created_by', 'updated_by', 'deleted_at', 'uploaded_at', 'updated_at',
  ],
  card_histories: ['id', 'card_id', 'old_content', 'changed_by', 'created_at'],
} as const;

export type SyncTable = keyof typeof SYNC_TABLES;
export type Row = Record<string, unknown>;

/** Tabel yang punya updated_at → pakai aturan last-write-wins. card_histories immutable. */
const VERSIONED: ReadonlySet<SyncTable> = new Set(['boards', 'lists', 'cards']);

export function isSyncTable(t: unknown): t is SyncTable {
  return typeof t === 'string' && Object.hasOwn(SYNC_TABLES, t);
}

export interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Row | null;
  old_record: Row | null;
}

export function parseWebhookPayload(body: unknown): WebhookPayload | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.type !== 'INSERT' && b.type !== 'UPDATE' && b.type !== 'DELETE') return null;
  if (typeof b.table !== 'string') return null;
  return {
    type: b.type,
    table: b.table,
    schema: typeof b.schema === 'string' ? b.schema : 'public',
    record: b.record && typeof b.record === 'object' ? (b.record as Row) : null,
    old_record: b.old_record && typeof b.old_record === 'object' ? (b.old_record as Row) : null,
  };
}

/** Ambil hanya kolom yang di-whitelist. Melempar error jika id tidak ada. */
export function pickColumns(table: SyncTable, record: Row): Row {
  const out: Row = {};
  for (const col of SYNC_TABLES[table]) {
    if (Object.hasOwn(record, col)) out[col] = record[col];
  }
  if (typeof out.id !== 'string' || out.id === '') {
    throw new Error(`record ${table} tanpa id`);
  }
  return out;
}

/**
 * Bangun query upsert berparameter.
 * - Tabel versioned: update hanya jika updated_at yang masuk >= yang tersimpan (last-write-wins),
 *   sehingga event yang datang terlambat/duplikat tidak menimpa data yang lebih baru.
 * - card_histories: insert sekali, abaikan duplikat.
 */
export function buildUpsert(table: SyncTable, row: Row): { text: string; params: unknown[] } {
  const cols = Object.keys(row);
  const params = cols.map((c) => row[c]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const colList = cols.map((c) => `"${c}"`).join(', ');
  let text = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT ("id") DO `;
  if (VERSIONED.has(table)) {
    const updates = cols
      .filter((c) => c !== 'id')
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .concat('"synced_at" = now()')
      .join(', ');
    text += `UPDATE SET ${updates} WHERE "${table}"."updated_at" <= EXCLUDED."updated_at"`;
  } else {
    text += 'NOTHING';
  }
  return { text, params };
}

/** Executor minimal agar logika bisa diuji tanpa database sungguhan. */
export interface Executor {
  unsafe(query: string, params?: unknown[]): Promise<unknown>;
}

export async function upsertRow(exec: Executor, table: SyncTable, record: Row): Promise<void> {
  const { text, params } = buildUpsert(table, pickColumns(table, record));
  await exec.unsafe(text, params);
}

/** Perbandingan secret yang tahan timing attack (panjang berbeda pun aman). */
export function verifySecret(provided: string | null, expected: string): boolean {
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Apakah perubahan kartu layak dikirimi notifikasi "kartu diubah". */
export function isNotifiableCardChange(record: Row | null, old: Row | null): boolean {
  if (!record || !old) return false;
  if (record.enable_notification !== true || record.deleted_at) return false;
  return (
    record.title !== old.title ||
    record.content !== old.content ||
    record.deadline_date !== old.deadline_date
  );
}
