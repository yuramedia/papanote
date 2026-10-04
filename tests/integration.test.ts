/**
 * Integration test terhadap PostgreSQL sungguhan.
 * Dijalankan hanya jika TEST_DATABASE_URL di-set (CI menyediakan service postgres).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('integrasi PostgreSQL internal', () => {
  let sql: import('bun').SQL;
  let upsertRow: typeof import('../server/sync').upsertRow;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    const { db } = await import('../server/db/client');
    const { migrate } = await import('../server/db/migrate');
    ({ upsertRow } = await import('../server/sync'));
    sql = db();
    await migrate();
    await migrate(); // idempoten
  });

  afterAll(async () => {
    await sql?.close();
  });

  const cardId = '00000000-0000-4000-8000-000000000001';
  const base = {
    id: cardId,
    list_id: '00000000-0000-4000-8000-0000000000aa',
    title: 'Kartu',
    content: 'v1',
    position: 1024,
    enable_notification: false,
    uploaded_at: '2026-10-01T00:00:00Z',
  };

  test('migrasi tercatat sekali', async () => {
    const rows = await sql`SELECT name FROM _migrations`;
    expect(rows.map((r: { name: string }) => r.name)).toEqual(['001_internal.sql']);
  });

  test('upsert insert lalu update yang lebih baru', async () => {
    await upsertRow(sql, 'cards', { ...base, updated_at: '2026-10-01T00:00:00Z' });
    await upsertRow(sql, 'cards', { ...base, content: 'v2', updated_at: '2026-10-02T00:00:00Z' });
    const [row] = await sql`SELECT content FROM cards WHERE id = ${cardId}`;
    expect(row.content).toBe('v2');
  });

  test('event terlambat (lebih lama) tidak menimpa', async () => {
    await upsertRow(sql, 'cards', { ...base, content: 'basi', updated_at: '2026-09-30T00:00:00Z' });
    const [row] = await sql`SELECT content FROM cards WHERE id = ${cardId}`;
    expect(row.content).toBe('v2');
  });

  test('card_histories duplikat diabaikan', async () => {
    const h = { id: '00000000-0000-4000-8000-0000000000b1', card_id: cardId, old_content: 'v1', created_at: '2026-10-02T00:00:00Z' };
    await upsertRow(sql, 'card_histories', h);
    await upsertRow(sql, 'card_histories', { ...h, old_content: 'diubah' });
    const rows = await sql`SELECT old_content FROM card_histories WHERE card_id = ${cardId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].old_content).toBe('v1');
  });
});
