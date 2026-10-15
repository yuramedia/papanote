import { describe, expect, it } from 'bun:test';
import {
  formatDeletedRelativeTime,
  resolveRestoreListId,
  filterTrashCards,
  filterTrashLists,
  type TrashCardItem,
  type TrashListItem,
} from '../src/lib/trash';
import type { Card, List } from '../src/lib/types';

describe('Recycle Bin & Trash Helper Module', () => {
  describe('formatDeletedRelativeTime', () => {
    const baseNow = new Date('2026-10-15T12:00:00.000Z');

    it('mengembalikan "Baru saja" untuk waktu kurang dari 1 menit', () => {
      const past = new Date('2026-10-15T11:59:30.000Z').toISOString();
      expect(formatDeletedRelativeTime(past, baseNow)).toBe('Baru saja');
    });

    it('mengembalikan format menit yang lalu', () => {
      const past = new Date('2026-10-15T11:45:00.000Z').toISOString();
      expect(formatDeletedRelativeTime(past, baseNow)).toBe('15 menit yang lalu');
    });

    it('mengembalikan format jam yang lalu', () => {
      const past = new Date('2026-10-15T09:00:00.000Z').toISOString();
      expect(formatDeletedRelativeTime(past, baseNow)).toBe('3 jam yang lalu');
    });

    it('mengembalikan "Kemarin" untuk 1 hari lalu', () => {
      const past = new Date('2026-10-14T11:00:00.000Z').toISOString();
      expect(formatDeletedRelativeTime(past, baseNow)).toBe('Kemarin');
    });

    it('mengembalikan format hari yang lalu untuk < 7 hari', () => {
      const past = new Date('2026-10-11T12:00:00.000Z').toISOString();
      expect(formatDeletedRelativeTime(past, baseNow)).toBe('4 hari yang lalu');
    });

    it('mengembalikan format minggu yang lalu untuk < 30 hari', () => {
      const past = new Date('2026-10-01T12:00:00.000Z').toISOString();
      expect(formatDeletedRelativeTime(past, baseNow)).toBe('2 minggu yang lalu');
    });

    it('menangani input null atau undefined dengan aman', () => {
      expect(formatDeletedRelativeTime(null)).toBe('Tidak diketahui');
      expect(formatDeletedRelativeTime(undefined)).toBe('Tidak diketahui');
    });
  });

  describe('resolveRestoreListId', () => {
    const activeLists: List[] = [
      { id: 'list-1', board_id: 'b1', title: 'To Do', position: 1000, deleted_at: null, created_at: '', updated_at: '' },
      { id: 'list-2', board_id: 'b1', title: 'In Progress', position: 2000, deleted_at: null, created_at: '', updated_at: '' },
    ];

    it('menggunakan list_id asli jika list tersebut masih aktif', () => {
      const card: Card = {
        id: 'c1',
        list_id: 'list-2',
        title: 'Fitur',
        content: '',
        position: 100,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: '2026-10-15T10:00:00Z',
        uploaded_at: '',
        updated_at: '',
      };
      const result = resolveRestoreListId(card, activeLists);
      expect(result).toBe('list-2');
    });

    it('menggunakan fallbackListId jika list asli tidak ada di activeLists', () => {
      const card: Card = {
        id: 'c1',
        list_id: 'list-deleted-99',
        title: 'Fitur',
        content: '',
        position: 100,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: '2026-10-15T10:00:00Z',
        uploaded_at: '',
        updated_at: '',
      };
      const result = resolveRestoreListId(card, activeLists, 'list-2');
      expect(result).toBe('list-2');
    });

    it('fallback ke list aktif pertama jika list asli terhapus dan tanpa fallback khusus', () => {
      const card: Card = {
        id: 'c1',
        list_id: 'list-deleted-99',
        title: 'Fitur',
        content: '',
        position: 100,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: '2026-10-15T10:00:00Z',
        uploaded_at: '',
        updated_at: '',
      };
      const result = resolveRestoreListId(card, activeLists);
      expect(result).toBe('list-1');
    });

    it('mengembalikan null jika tidak ada list aktif sama sekali', () => {
      const card: Card = {
        id: 'c1',
        list_id: 'list-99',
        title: 'Fitur',
        content: '',
        position: 100,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: '2026-10-15T10:00:00Z',
        uploaded_at: '',
        updated_at: '',
      };
      const result = resolveRestoreListId(card, []);
      expect(result).toBeNull();
    });
  });

  describe('filterTrashCards & filterTrashLists', () => {
    const mockCards: TrashCardItem[] = [
      {
        id: 'c1',
        list_id: 'l1',
        title: 'Desain Arsitektur Sistem',
        content: 'Dokumentasi database Supabase',
        position: 1,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: '2026-10-15T10:00:00Z',
        uploaded_at: '',
        updated_at: '',
        listTitle: 'Backlog',
        isListDeleted: false,
      },
      {
        id: 'c2',
        list_id: 'l2',
        title: 'Testing Vitest & Bun',
        content: 'Setup unit testing pipeline',
        position: 2,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: '2026-10-15T11:00:00Z',
        uploaded_at: '',
        updated_at: '',
        listTitle: 'QA Testing',
        isListDeleted: true,
      },
    ];

    const mockLists: TrashListItem[] = [
      {
        id: 'l1',
        board_id: 'b1',
        title: 'Kolom Ide Liar',
        position: 1,
        deleted_at: '2026-10-15T09:00:00Z',
        created_at: '',
        updated_at: '',
        cardCount: 5,
      },
      {
        id: 'l2',
        board_id: 'b1',
        title: 'Arsip Sprint 12',
        position: 2,
        deleted_at: '2026-10-15T08:00:00Z',
        created_at: '',
        updated_at: '',
        cardCount: 0,
      },
    ];

    it('filterTrashCards memfilter berdasarkan judul', () => {
      const res = filterTrashCards(mockCards, 'Arsitektur');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('c1');
    });

    it('filterTrashCards memfilter berdasarkan isi konten', () => {
      const res = filterTrashCards(mockCards, 'pipeline');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('c2');
    });

    it('filterTrashCards memfilter berdasarkan nama list asal', () => {
      const res = filterTrashCards(mockCards, 'Backlog');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('c1');
    });

    it('filterTrashCards mengembalikan semua kartu jika query kosong', () => {
      const res = filterTrashCards(mockCards, '   ');
      expect(res).toHaveLength(2);
    });

    it('filterTrashLists memfilter berdasarkan judul list', () => {
      const res = filterTrashLists(mockLists, 'Sprint');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('l2');
    });

    it('filterTrashLists mengembalikan semua list jika query kosong', () => {
      const res = filterTrashLists(mockLists, '');
      expect(res).toHaveLength(2);
    });
  });
});
