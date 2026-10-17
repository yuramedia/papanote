import { describe, expect, it } from 'bun:test';
import {
  extractMentions,
  filterMentionSuggestions,
  formatCommentHtml,
  toggleCommentReaction,
  type MentionMember,
} from '../src/lib/comments';

describe('Card Comments & Mention System', () => {
  describe('extractMentions', () => {
    it('mendeteksi sebutan tunggal @username', () => {
      const text = 'Halo @yura tolong cek revisi catatan ini.';
      expect(extractMentions(text)).toEqual(['yura']);
    });

    it('mendeteksi banyak sebutan dan menormalkan ke huruf kecil', () => {
      const text = 'Cc @Admin, @yura-media, dan @Budi_99!';
      const mentions = extractMentions(text);
      expect(mentions).toContain('admin');
      expect(mentions).toContain('yura-media');
      expect(mentions).toContain('budi_99');
      expect(mentions).toHaveLength(3);
    });

    it('menghilangkan duplikasi sebutan yang sama', () => {
      const text = '@yura dan @YURA mendiskusikan tugas.';
      expect(extractMentions(text)).toEqual(['yura']);
    });

    it('mengembalikan array kosong jika tidak ada mention', () => {
      expect(extractMentions('Hanya teks komentar biasa tanpa mention.')).toEqual([]);
      expect(extractMentions('')).toEqual([]);
    });
  });

  describe('filterMentionSuggestions', () => {
    const mockMembers: MentionMember[] = [
      { id: '1', username: 'yura', email: 'yura@media.com' },
      { id: '2', username: 'admin_tim', email: 'admin@papanote.com' },
      { id: '3', username: 'budi_santoso', email: 'budi@gmail.com' },
    ];

    it('memfilter berdasarkan kecocokan username', () => {
      const res = filterMentionSuggestions(mockMembers, 'yur');
      expect(res).toHaveLength(1);
      expect(res[0].username).toBe('yura');
    });

    it('menangani input query yang diawali simbol @', () => {
      const res = filterMentionSuggestions(mockMembers, '@admin');
      expect(res).toHaveLength(1);
      expect(res[0].username).toBe('admin_tim');
    });

    it('memfilter berdasarkan email jika username berbeda', () => {
      const res = filterMentionSuggestions(mockMembers, 'papanote');
      expect(res).toHaveLength(1);
      expect(res[0].username).toBe('admin_tim');
    });

    it('mengembalikan seluruh anggota jika query kosong', () => {
      expect(filterMentionSuggestions(mockMembers, '')).toHaveLength(3);
      expect(filterMentionSuggestions(mockMembers, '@')).toHaveLength(3);
    });
  });

  describe('formatCommentHtml', () => {
    it('menggantikan @mention menjadi chip HTML tersorot', () => {
      const formatted = formatCommentHtml('Mohon dicek @yura ya.');
      expect(formatted).toContain('<span class="inline-flex items-center gap-0.5');
      expect(formatted).toContain('@yura</span>');
    });

    it('memberikan sorotan khusus (amber) jika mention ditujukan ke pengguna saat ini', () => {
      const formatted = formatCommentHtml('Cc @yura penting!', 'yura');
      expect(formatted).toContain('bg-amber-400/25');
      expect(formatted).toContain('text-amber-700');
    });

    it('mengonversi baris baru menjadi tag <br />', () => {
      const formatted = formatCommentHtml('Baris 1\nBaris 2');
      expect(formatted).toBe('Baris 1<br />Baris 2');
    });

    it('mengamankan karakter HTML berbahaya (anti-XSS)', () => {
      const formatted = formatCommentHtml('<script>alert("hack")</script>');
      expect(formatted).not.toContain('<script>');
      expect(formatted).toContain('&lt;script&gt;');
    });
  });

  describe('toggleCommentReaction', () => {
    it('menambahkan reaksi baru jika user belum bereaksi', () => {
      const res = toggleCommentReaction(undefined, '👍', 'user-1');
      expect(res).toEqual({ '👍': ['user-1'] });
    });

    it('menambahkan user ke daftar reaksi emoji yang sudah ada', () => {
      const current = { '👍': ['user-1'] };
      const res = toggleCommentReaction(current, '👍', 'user-2');
      expect(res['👍']).toEqual(['user-1', 'user-2']);
    });

    it('menghapus reaksi jika user mengklik kembali emoji yang sama (toggle off)', () => {
      const current = { '👍': ['user-1', 'user-2'] };
      const res = toggleCommentReaction(current, '👍', 'user-1');
      expect(res['👍']).toEqual(['user-2']);
    });

    it('menghapus kunci emoji dari objek jika jumlah user menjadi 0', () => {
      const current = { '👍': ['user-1'] };
      const res = toggleCommentReaction(current, '👍', 'user-1');
      expect(res['👍']).toBeUndefined();
    });
  });
});
