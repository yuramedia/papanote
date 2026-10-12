import { describe, expect, it } from 'bun:test';
import { highlightSegments, extractSnippet, searchCards } from '../src/lib/omnisearch';
import type { Card, List } from '../src/lib/types';

describe('Omnisearch Module', () => {
  describe('highlightSegments', () => {
    it('memecah teks menjadi segmen kata cocok dan tidak cocok', () => {
      const segs = highlightSegments('Desain antarmuka Kanban untuk tim', 'kanban');
      expect(segs).toEqual([
        { text: 'Desain antarmuka ', isMatch: false },
        { text: 'Kanban', isMatch: true },
        { text: ' untuk tim', isMatch: false },
      ]);
    });

    it('menangani kecocokan berulang dan case-insensitive', () => {
      const segs = highlightSegments('Bug di backend dan BUG di worker', 'bug');
      expect(segs).toEqual([
        { text: 'Bug', isMatch: true },
        { text: ' di backend dan ', isMatch: false },
        { text: 'BUG', isMatch: true },
        { text: ' di worker', isMatch: false },
      ]);
    });

    it('aman dari karakter regex spesial', () => {
      const segs = highlightSegments('Gunakan C++ atau [Vue] untuk komponen', 'C++');
      expect(segs).toEqual([
        { text: 'Gunakan ', isMatch: false },
        { text: 'C++', isMatch: true },
        { text: ' atau [Vue] untuk komponen', isMatch: false },
      ]);
    });

    it('mengembalikan teks utuh jika query kosong', () => {
      const segs = highlightSegments('Teks biasa', '');
      expect(segs).toEqual([{ text: 'Teks biasa', isMatch: false }]);
    });
  });

  describe('extractSnippet', () => {
    it('mengekstrak kalimat di sekitar kata kunci yang cocok', () => {
      const content = `
# Catatan Arsitektur Sistem
Kami telah merancang arsitektur baru dengan menggunakan Supabase Postgres di region Singapore agar latensi tetap di bawah 20ms.
Sistem ini mendukung sinkronisasi realtime.
      `;
      const snippet = extractSnippet(content, 'Singapore');
      expect(snippet).not.toBeNull();
      expect(snippet?.toLowerCase()).toContain('singapore');
      expect(snippet).not.toContain('#');
    });

    it('membersihkan kode blok dari snippet', () => {
      const content = 'Gunakan kode ```typescript\nconst a = 123;\n``` pada deployment staging.';
      const snippet = extractSnippet(content, 'staging');
      expect(snippet).not.toBeNull();
      expect(snippet).toContain('staging');
      expect(snippet).not.toContain('typescript');
      expect(snippet).not.toContain('const a = 123');
    });

    it('mengembalikan null jika query tidak ditemukan sama sekali', () => {
      const snippet = extractSnippet('Hanya teks sederhana.', 'tidakada');
      expect(snippet).toBeNull();
    });
  });

  describe('searchCards', () => {
    const dummyLists: List[] = [
      { id: 'l1', board_id: 'b1', title: 'To Do', position: 1000, deleted_at: null, created_at: '', updated_at: '' },
      { id: 'l2', board_id: 'b1', title: 'In Progress', position: 2000, deleted_at: null, created_at: '', updated_at: '' },
    ];

    const dummyCards: Card[] = [
      {
        id: 'c1',
        list_id: 'l1',
        title: 'Desain Figma Halaman Utama',
        content: 'Rancangan UI landing page #design',
        position: 1000,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: null,
        uploaded_at: '',
        updated_at: '',
      },
      {
        id: 'c2',
        list_id: 'l2',
        title: 'Optimalisasi Database',
        content: 'Mempercepat query Supabase PostgreSQL dan webhook sync.',
        position: 2000,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: null,
        uploaded_at: '',
        updated_at: '',
      },
      {
        id: 'c3',
        list_id: 'l1',
        title: 'Backend Refactoring',
        content: 'Memperbaiki endpoint REST API #urgent #backend',
        position: 3000,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: null,
        uploaded_at: '',
        updated_at: '',
      },
      {
        id: 'c4',
        list_id: 'l1',
        title: 'Kartu Terhapus',
        content: 'Konten terhapus #urgent',
        position: 4000,
        deadline_date: null,
        enable_notification: false,
        created_by: null,
        updated_by: null,
        deleted_at: '2026-01-01',
        uploaded_at: '',
        updated_at: '',
      },
    ];

    it('menemukan kartu berdasarkan kecocokan judul dengan skor tertinggi', () => {
      const results = searchCards(dummyCards, 'Desain', dummyLists);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].card.id).toBe('c1');
      expect(results[0].matchedField).toBe('title');
      expect(results[0].listTitle).toBe('To Do');
    });

    it('menemukan kartu berdasarkan isi badan catatan (deep full-text search)', () => {
      const results = searchCards(dummyCards, 'PostgreSQL', dummyLists);
      expect(results.length).toBe(1);
      expect(results[0].card.id).toBe('c2');
      expect(results[0].matchedField).toBe('content');
      expect(results[0].snippetText).toContain('PostgreSQL');
    });

    it('menemukan kartu berdasarkan tagar #tag', () => {
      const results = searchCards(dummyCards, 'urgent', dummyLists);
      expect(results.length).toBe(1);
      expect(results[0].card.id).toBe('c3');
      expect(results[0].tags).toContain('urgent');
    });

    it('mengabaikan kartu yang berstatus soft-deleted', () => {
      const results = searchCards(dummyCards, 'Terhapus', dummyLists);
      expect(results.length).toBe(0);
    });

    it('mengembalikan daftar kartu awal jika query kosong', () => {
      const results = searchCards(dummyCards, '', dummyLists);
      expect(results.length).toBe(3); // 3 kartu aktif
    });
  });
});
