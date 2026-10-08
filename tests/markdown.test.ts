import { describe, expect, test } from 'bun:test';
import { renderMarkdown } from '../src/lib/markdown';

describe('renderMarkdown', () => {
  test('render heading dan teks tebal', () => {
    const html = renderMarkdown('# Catatan\n\nIni **penting**');
    expect(html).toContain('<h1>Catatan</h1>');
    expect(html).toContain('<strong>penting</strong>');
  });

  test('render checklist task items', () => {
    const html = renderMarkdown('- [ ] Tugas 1\n- [x] Selesai');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  test('render Obsidian-style wikilinks [[Target]]', () => {
    const html = renderMarkdown('Lihat referensi di [[Rencana Q4]] sekarang.');
    expect(html).toContain('obsidian-wikilink');
    expect(html).toContain('data-wikilink="Rencana%20Q4"');
    expect(html).toContain('Rencana Q4');
  });

  test('render Obsidian-style wikilinks dengan alias [[Target|Alias]]', () => {
    const html = renderMarkdown('Buka [[doc-123|Dokumen Utama]]');
    expect(html).toContain('data-wikilink="doc-123"');
    expect(html).toContain('Dokumen Utama');
  });

  test('placeholder saat konten kosong', () => {
    const html = renderMarkdown('');
    expect(html).toContain('Belum ada catatan');
  });
});
