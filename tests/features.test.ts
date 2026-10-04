import { describe, expect, test } from 'bun:test';
import { reminderBody, reminderKindFor } from '../server/jobs/deadlines';
import { mergeRow } from '../src/lib/merge';
import { buildDocument, buildOutline, exportFileName } from '../src/lib/export-docx';
import { Packer } from 'docx';
import type { Card, List } from '../src/lib/types';

const H = 60 * 60 * 1000;

describe('reminderKindFor', () => {
  const now = new Date('2026-10-04T00:00:00Z');
  const at = (ms: number) => new Date(now.getTime() + ms);
  test('jendela 1 jam', () => {
    expect(reminderKindFor(at(30 * 60 * 1000), now)).toBe('1h');
    expect(reminderKindFor(at(H), now)).toBe('1h');
  });
  test('jendela 24 jam', () => {
    expect(reminderKindFor(at(H + 1), now)).toBe('24h');
    expect(reminderKindFor(at(24 * H), now)).toBe('24h');
  });
  test('di luar jendela', () => {
    expect(reminderKindFor(at(24 * H + 1), now)).toBeNull();
    expect(reminderKindFor(at(-1), now)).toBeNull();
    expect(reminderKindFor(now, now)).toBeNull();
  });
  test('isi pesan memakai WIB', () => {
    expect(reminderBody('Laporan', '1h', new Date('2026-10-04T03:00:00Z'))).toContain('10.00 WIB');
  });
});

describe('mergeRow (realtime last-write-wins)', () => {
  const row = (id: string, updated_at: string, extra: Partial<{ deleted_at: string | null; title: string }> = {}) => ({
    id,
    updated_at,
    deleted_at: null as string | null,
    title: 't',
    ...extra,
  });
  test('insert baris baru', () => {
    expect(mergeRow([], row('a', '2026-01-01'))).toHaveLength(1);
  });
  test('replace jika lebih baru', () => {
    const out = mergeRow([row('a', '2026-01-01')], row('a', '2026-01-02', { title: 'baru' }));
    expect(out[0].title).toBe('baru');
  });
  test('abaikan jika lokal lebih baru', () => {
    const items = [row('a', '2026-01-03', { title: 'lokal' })];
    expect(mergeRow(items, row('a', '2026-01-02', { title: 'lama' }))).toBe(items);
  });
  test('soft-delete membuang dari tampilan', () => {
    expect(mergeRow([row('a', '2026-01-01')], row('a', '2026-01-02', { deleted_at: 'x' }))).toHaveLength(0);
  });
});

describe('ekspor .docx', () => {
  const list = (id: string, title: string, position: number): List => ({
    id, board_id: 'b', title, position, deleted_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  });
  const card = (id: string, list_id: string, title: string, position: number, extra: Partial<Card> = {}): Card => ({
    id, list_id, title, content: '', position, deadline_date: null, enable_notification: false, created_by: null,
    updated_by: null, deleted_at: null, uploaded_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...extra,
  });

  const lists = [list('l2', 'Selesai', 2048), list('l1', 'To do', 1024), { ...list('l3', 'Terhapus', 3000), deleted_at: 'x' }];
  const cards = [
    card('c2', 'l1', 'Kedua', 2000, { content: 'baris 1\nbaris 2', deadline_date: '2026-10-05T03:00:00Z' }),
    card('c1', 'l1', 'Pertama', 1000),
    card('c3', 'l1', 'Dihapus', 500, { deleted_at: 'x' }),
  ];

  test('outline urut sesuai posisi & mengabaikan yang terhapus', () => {
    const o = buildOutline({ title: 'Papan Tim' }, lists, cards);
    expect(o.lists.map((l) => l.title)).toEqual(['To do', 'Selesai']);
    expect(o.lists[0].cards.map((c) => c.title)).toEqual(['Pertama', 'Kedua']);
    expect(o.lists[0].cards[1].lines).toEqual(['baris 1', 'baris 2']);
    expect(o.lists[0].cards[1].deadline).not.toBeNull();
  });

  test('menghasilkan berkas .docx (zip) yang valid', async () => {
    const buf = await Packer.toBuffer(buildDocument(buildOutline({ title: 'Papan Tim' }, lists, cards)));
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });

  test('nama file aman', () => {
    expect(exportFileName('Rapat: Q4/2026', new Date('2026-10-04T00:00:00Z'))).toBe('Rapat-Q42026-2026-10-04.docx');
  });
});
