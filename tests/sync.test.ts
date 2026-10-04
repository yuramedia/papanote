import { describe, expect, test } from 'bun:test';
import {
  buildUpsert,
  isNotifiableCardChange,
  isSyncTable,
  parseWebhookPayload,
  pickColumns,
  upsertRow,
  verifySecret,
} from '../server/sync';
import { selectVerified } from '../server/jobs/cleanup';

describe('verifySecret', () => {
  test('cocok → true', () => expect(verifySecret('rahasia', 'rahasia')).toBe(true));
  test('beda / kosong → false', () => {
    expect(verifySecret('salah', 'rahasia')).toBe(false);
    expect(verifySecret(null, 'rahasia')).toBe(false);
    expect(verifySecret('rahasia', '')).toBe(false);
    expect(verifySecret('rahasia-lebih-panjang', 'rahasia')).toBe(false);
  });
});

describe('parseWebhookPayload', () => {
  test('payload valid', () => {
    const p = parseWebhookPayload({ type: 'UPDATE', table: 'cards', schema: 'public', record: { id: 'a' }, old_record: null });
    expect(p?.type).toBe('UPDATE');
    expect(p?.record).toEqual({ id: 'a' });
  });
  test('payload tidak valid', () => {
    expect(parseWebhookPayload(null)).toBeNull();
    expect(parseWebhookPayload({ type: 'TRUNCATE', table: 'cards' })).toBeNull();
    expect(parseWebhookPayload({ type: 'INSERT' })).toBeNull();
  });
});

describe('whitelist', () => {
  test('tabel yang dikenal', () => {
    expect(isSyncTable('cards')).toBe(true);
    expect(isSyncTable('push_subscriptions')).toBe(false);
    expect(isSyncTable('__proto__')).toBe(false);
  });
  test('kolom asing dibuang', () => {
    const row = pickColumns('cards', { id: 'x', title: 't', evil: 'DROP TABLE', 'title"; --': 1 });
    expect(Object.keys(row).sort()).toEqual(['id', 'title']);
  });
  test('tanpa id → error', () => {
    expect(() => pickColumns('cards', { title: 't' })).toThrow();
  });
});

describe('buildUpsert', () => {
  test('tabel versioned memakai last-write-wins', () => {
    const { text, params } = buildUpsert('cards', { id: 'x', title: 't', updated_at: '2026-01-01T00:00:00Z' });
    expect(text).toContain('INSERT INTO "cards" ("id", "title", "updated_at") VALUES ($1, $2, $3)');
    expect(text).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(text).toContain('"synced_at" = now()');
    expect(text).toContain('WHERE "cards"."updated_at" <= EXCLUDED."updated_at"');
    expect(text).not.toContain('"id" = EXCLUDED."id"');
    expect(params).toEqual(['x', 't', '2026-01-01T00:00:00Z']);
  });
  test('card_histories immutable → DO NOTHING', () => {
    const { text } = buildUpsert('card_histories', { id: 'h', card_id: 'x', old_content: 'lama' });
    expect(text).toEndWith('DO NOTHING');
  });
  test('upsertRow meneruskan query berparameter ke executor', async () => {
    const calls: [string, unknown[] | undefined][] = [];
    await upsertRow({ unsafe: async (q, p) => calls.push([q, p]) }, 'lists', {
      id: 'l1', board_id: 'b1', title: 'To do', position: 1024, updated_at: 'now', injected: 'x',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual(['l1', 'b1', 'To do', 1024, 'now']);
  });
});

describe('isNotifiableCardChange', () => {
  const base = { id: 'c', title: 'A', content: 'x', deadline_date: null, enable_notification: true, deleted_at: null };
  test('konten berubah & notifikasi aktif → true', () => {
    expect(isNotifiableCardChange({ ...base, content: 'y' }, base)).toBe(true);
  });
  test('hanya posisi berubah → false', () => {
    expect(isNotifiableCardChange({ ...base, position: 2 }, { ...base, position: 1 })).toBe(false);
  });
  test('notifikasi nonaktif / terhapus → false', () => {
    expect(isNotifiableCardChange({ ...base, content: 'y', enable_notification: false }, base)).toBe(false);
    expect(isNotifiableCardChange({ ...base, content: 'y', deleted_at: 'now' }, base)).toBe(false);
  });
});

describe('selectVerified (purge cache aman)', () => {
  test('hanya baris yang sudah ada & up-to-date di internal', () => {
    const internal = new Map<string, string | null>([
      ['a', '2026-01-02T00:00:00.000Z'],
      ['b', '2026-01-01T00:00:00.000Z'],
    ]);
    const result = selectVerified(
      [
        { id: 'a', updated_at: '2026-01-02T00:00:00Z' }, // sama → aman
        { id: 'b', updated_at: '2026-01-03T00:00:00Z' }, // internal lebih lama → tahan
        { id: 'c', updated_at: '2026-01-01T00:00:00Z' }, // belum tersinkron → tahan
      ],
      internal,
    );
    expect(result).toEqual(['a']);
  });
  test('card_histories (tanpa updated_at) cukup ada di internal', () => {
    expect(selectVerified([{ id: 'h1' }, { id: 'h2' }], new Map([['h1', null]]))).toEqual(['h1']);
  });
});
