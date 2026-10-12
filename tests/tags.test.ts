import { describe, expect, it } from 'bun:test';
import { extractTags, getTagColor, getAllTagsWithCount, filterCardsByTags } from '../src/lib/tags';
import type { Card } from '../src/lib/types';

describe('Tags System (#tags)', () => {
  describe('extractTags', () => {
    it('mendeteksi tagar standar dan jamak', () => {
      const content = 'Catatan ini memiliki #urgent dan #design serta #catatan';
      expect(extractTags(content)).toEqual(['catatan', 'design', 'urgent']);
    });

    it('mendeteksi nested tags dan pemisah dash/underscore', () => {
      const content = 'Mengerjakan #proyek/papanote dan fitur #sub-task serta #api_v2';
      expect(extractTags(content)).toEqual(['api_v2', 'proyek/papanote', 'sub-task']);
    });

    it('mengabaikan heading Markdown (# Judul, ## Subjudul)', () => {
      const content = `
# Judul Utama Catatan
Ini adalah teks pengantar.
## Subjudul Tingkat Dua
### Heading Tiga
Teks dengan tag sah: #feature
      `;
      expect(extractTags(content)).toEqual(['feature']);
    });

    it('mengabaikan kode warna heksadesimal (#fff, #ffffff, #38bdf8)', () => {
      const content = 'Gunakan warna #ffffff atau #38bdf8 dan #fff untuk tema dark, tandai #design';
      expect(extractTags(content)).toEqual(['design']);
    });

    it('mengabaikan angka murni (#123, #2026)', () => {
      const content = 'Rilis versi #2026 nomor #123 tapi ini versi #v2';
      expect(extractTags(content)).toEqual(['v2']);
    });

    it('mengabaikan tagar di dalam blok kode dan inline code', () => {
      const content = `
Fitur utama #p1
\`\`\`css
/* Ini kode CSS */
.header { color: #38bdf8; #bukan_tag }
\`\`\`
Dan kode inline \`#bukan_juga\`
Tag asli: #review
      `;
      expect(extractTags(content)).toEqual(['p1', 'review']);
    });

    it('mengabaikan anchor link di URL markdown [label](url#anchor)', () => {
      const content = 'Buka panduan di [docs](https://example.com/guide#section) lalu beri #revisi';
      expect(extractTags(content)).toEqual(['revisi']);
    });

    it('menangani tanda baca yang mengapit tagar', () => {
      const content = 'Ada (#urgent), lalu [#design], dan kata di akhir kalimat #selesai.';
      expect(extractTags(content)).toEqual(['design', 'selesai', 'urgent']);
    });

    it('menolak tag yang diawali/diakhiri garis miring atau strip', () => {
      const content = 'Bukan tag: #/salah #-salah #salah- #salah/ #salah//dobel tapi #sah/oke';
      expect(extractTags(content)).toEqual(['sah/oke']);
    });

    it('mengembalikan array kosong jika teks null, undefined, atau tanpa tag', () => {
      expect(extractTags('')).toEqual([]);
      expect(extractTags(null)).toEqual([]);
      expect(extractTags(undefined)).toEqual([]);
      expect(extractTags('Hanya catatan biasa tanpa tanda pagar.')).toEqual([]);
    });
  });

  describe('getTagColor', () => {
    it('memberikan warna semantik yang tepat untuk tag khusus', () => {
      const urgent = getTagColor('urgent');
      expect(urgent.dotHex).toBe('#f43f5e'); // Rose
      const done = getTagColor('#done');
      expect(done.dotHex).toBe('#10b981'); // Emerald
    });

    it('menghasilkan warna yang konsisten dan stabil untuk tag kustom', () => {
      const c1 = getTagColor('custom-tag');
      const c2 = getTagColor('custom-tag');
      expect(c1.dotHex).toBe(c2.dotHex);
      expect(c1.badge).toBe(c2.badge);
    });
  });

  describe('getAllTagsWithCount', () => {
    it('menghitung frekuensi tagar di seluruh kartu dan mengurutkannya', () => {
      const dummyCards = [
        { id: '1', content: 'Catatan #urgent #design', deleted_at: null } as Card,
        { id: '2', content: 'Revisi #design untuk web', deleted_at: null } as Card,
        { id: '3', content: 'Fix #urgent #bug #design', deleted_at: null } as Card,
        { id: '4', content: 'Terhapus #urgent', deleted_at: '2026-01-01' } as Card,
      ];

      const counts = getAllTagsWithCount(dummyCards);
      expect(counts).toEqual([
        { tag: 'design', count: 3 },
        { tag: 'urgent', count: 2 },
        { tag: 'bug', count: 1 },
      ]);
    });
  });

  describe('filterCardsByTags', () => {
    const dummyCards = [
      { id: '1', title: 'Task 1', content: '#urgent #frontend', deleted_at: null } as Card,
      { id: '2', title: 'Task 2', content: '#urgent #backend', deleted_at: null } as Card,
      { id: '3', title: 'Task 3', content: '#backend #docs', deleted_at: null } as Card,
    ];

    it('mengembalikan semua kartu jika activeTags kosong', () => {
      expect(filterCardsByTags(dummyCards, [])).toEqual(dummyCards);
    });

    it('memfilter kartu yang memiliki tag tunggal', () => {
      const res = filterCardsByTags(dummyCards, ['urgent']);
      expect(res.map((c) => c.id)).toEqual(['1', '2']);
    });

    it('memfilter kartu dengan irisan beberapa tag (AND match)', () => {
      const res = filterCardsByTags(dummyCards, ['urgent', 'backend']);
      expect(res.map((c) => c.id)).toEqual(['2']);
    });
  });
});
