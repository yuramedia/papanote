import { describe, expect, it } from 'bun:test';
import { filterTableCards, sortTableCards } from '../src/lib/table';
import type { Card, List } from '../src/lib/types';

describe('Table View Data Module', () => {
  const dummyLists: List[] = [
    { id: 'l1', board_id: 'b1', title: 'To Do', position: 1000, deleted_at: null, created_at: '', updated_at: '' },
    { id: 'l2', board_id: 'b1', title: 'Doing', position: 2000, deleted_at: null, created_at: '', updated_at: '' },
    { id: 'l3', board_id: 'b1', title: 'Done', position: 3000, deleted_at: null, created_at: '', updated_at: '' },
  ];

  const dummyCards: Card[] = [
    {
      id: 'c1',
      list_id: 'l1',
      title: 'B Design UI',
      content: 'Detail desain #figma #urgent',
      position: 1000,
      deadline_date: '2026-10-20T10:00:00Z',
      enable_notification: false,
      created_by: null,
      updated_by: null,
      deleted_at: null,
      uploaded_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:00:00Z',
    },
    {
      id: 'c2',
      list_id: 'l2',
      title: 'A Setup Database',
      content: 'Migrasi PostgreSQL #backend',
      position: 2000,
      deadline_date: '2026-10-15T12:00:00Z',
      enable_notification: true,
      created_by: null,
      updated_by: null,
      deleted_at: null,
      uploaded_at: '2026-10-05T10:00:00Z',
      updated_at: '2026-10-05T10:00:00Z',
    },
    {
      id: 'c3',
      list_id: 'l3',
      title: 'C QA Testing',
      content: 'Uji coba seluruh fitur #done',
      position: 3000,
      deadline_date: null,
      enable_notification: false,
      created_by: null,
      updated_by: null,
      deleted_at: null,
      uploaded_at: '2026-10-10T10:00:00Z',
      updated_at: '2026-10-10T10:00:00Z',
    },
    {
      id: 'c4',
      list_id: 'l1',
      title: 'D Dihapus',
      content: 'Sudah tidak dipakai',
      position: 4000,
      deadline_date: null,
      enable_notification: false,
      created_by: null,
      updated_by: null,
      deleted_at: '2026-10-08T00:00:00Z',
      uploaded_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    },
  ];

  describe('filterTableCards', () => {
    it('mengabaikan kartu yang soft-deleted', () => {
      const res = filterTableCards(dummyCards, {}, dummyLists);
      expect(res.length).toBe(3);
      expect(res.some((c) => c.id === 'c4')).toBe(false);
    });

    it('memfilter kartu berdasarkan List ID', () => {
      const res = filterTableCards(dummyCards, { listId: 'l2' }, dummyLists);
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('c2');
    });

    it('memfilter kartu berdasarkan query teks pencarian', () => {
      const res = filterTableCards(dummyCards, { query: 'PostgreSQL' }, dummyLists);
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('c2');
    });

    it('memfilter kartu berdasarkan tagar aktif', () => {
      const res = filterTableCards(dummyCards, { activeTags: ['urgent'] }, dummyLists);
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('c1');
    });
  });

  describe('sortTableCards', () => {
    it('mengurutkan berdasarkan judul (ASC dan DESC)', () => {
      const asc = sortTableCards(dummyCards.slice(0, 3), 'title', 'asc', dummyLists);
      expect(asc.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);

      const desc = sortTableCards(dummyCards.slice(0, 3), 'title', 'desc', dummyLists);
      expect(desc.map((c) => c.id)).toEqual(['c3', 'c1', 'c2']);
    });

    it('mengurutkan berdasarkan deadline (ASC meletakkan deadline terdekat lebih dulu)', () => {
      const asc = sortTableCards(dummyCards.slice(0, 3), 'deadline', 'asc', dummyLists);
      expect(asc.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']); // c2 (15 Okt), c1 (20 Okt), c3 (null di akhir)
    });

    it('mengurutkan berdasarkan tanggal dibuat (created)', () => {
      const desc = sortTableCards(dummyCards.slice(0, 3), 'created', 'desc', dummyLists);
      expect(desc.map((c) => c.id)).toEqual(['c3', 'c2', 'c1']); // c3 (10 Okt), c2 (5 Okt), c1 (1 Okt)
    });
  });
});
