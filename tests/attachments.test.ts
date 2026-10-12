import { describe, expect, it } from 'bun:test';
import { extractFirstImage, cleanSnippet, insertImageMarkdown } from '../src/lib/attachments';

describe('attachments helper', () => {
  it('extractFirstImage mendeteksi URL gambar markdown', () => {
    const content = '# Judul Catatan\nIni adalah teks pendahuluan.\n\n![Mockup Desain](https://example.com/mockup.png)\n\nCatatan penutup.';
    expect(extractFirstImage(content)).toBe('https://example.com/mockup.png');
  });

  it('extractFirstImage mendeteksi data URL base64', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const content = `Teks biasa\n![Tangkapan Layar](${dataUrl})`;
    expect(extractFirstImage(content)).toBe(dataUrl);
  });

  it('extractFirstImage mendeteksi tag HTML img', () => {
    const content = '<p>Catatan penting</p><img src="https://cdn.example.com/photo.jpg" alt="Foto" />';
    expect(extractFirstImage(content)).toBe('https://cdn.example.com/photo.jpg');
  });

  it('extractFirstImage mengembalikan null jika tidak ada gambar', () => {
    const content = '# Judul\nHanya teks markdown biasa tanpa gambar apapun.';
    expect(extractFirstImage(content)).toBeNull();
    expect(extractFirstImage('')).toBeNull();
    expect(extractFirstImage(null)).toBeNull();
  });

  it('cleanSnippet membersihkan tag gambar dan heading dari teks cuplikan', () => {
    const content = '## Prioritas Tinggi\n![Diagram](https://example.com/dia.png)\nSelesaikan implementasi fitur segera [[Kartu Lain]].';
    const cleaned = cleanSnippet(content);
    expect(cleaned).not.toContain('![Diagram]');
    expect(cleaned).not.toContain('https://example.com/dia.png');
    expect(cleaned).not.toContain('##');
    expect(cleaned).toContain('Selesaikan implementasi fitur segera Kartu Lain.');
  });

  it('insertImageMarkdown menyisipkan gambar di posisi kursor', () => {
    const content = 'Halo dunia';
    const result = insertImageMarkdown(content, 'https://example.com/img.png', 'Contoh', 4);
    expect(result.newContent).toContain('Halo\n![Contoh](https://example.com/img.png)\n dunia');
    expect(result.newCursor).toBeGreaterThan(4);
  });

  it('insertImageMarkdown menambahkan gambar di akhir jika kursor tidak diberikan', () => {
    const content = 'Teks sebelumnya';
    const result = insertImageMarkdown(content, 'https://example.com/img.png', 'Foto');
    expect(result.newContent.endsWith('![Foto](https://example.com/img.png)\n')).toBe(true);
  });
});
