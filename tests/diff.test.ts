import { describe, expect, it } from 'bun:test';
import { computeLineDiff } from '../src/lib/diff';

describe('computeLineDiff', () => {
  it('mendeteksi baris yang sama tanpa perubahan', () => {
    const text = 'Satu\nDua\nTiga';
    const result = computeLineDiff(text, text);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.lines.every((l) => l.type === 'unchanged')).toBe(true);
    expect(result.lines.length).toBe(3);
  });

  it('mendeteksi baris yang ditambahkan (+)', () => {
    const oldText = 'Baris 1\nBaris 3';
    const newText = 'Baris 1\nBaris 2 Baru\nBaris 3';
    const result = computeLineDiff(oldText, newText);

    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(0);
    expect(result.lines[1].type).toBe('added');
    expect(result.lines[1].text).toBe('Baris 2 Baru');
  });

  it('mendeteksi baris yang dihapus (-)', () => {
    const oldText = 'A\nB\nC';
    const newText = 'A\nC';
    const result = computeLineDiff(oldText, newText);

    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(1);
    expect(result.lines[1].type).toBe('removed');
    expect(result.lines[1].text).toBe('B');
  });

  it('mendeteksi perubahan gabungan (penambahan dan penghapusan)', () => {
    const oldText = 'Catatan Awal\nPoin Lama';
    const newText = 'Catatan Awal\nPoin Baru 1\nPoin Baru 2';
    const result = computeLineDiff(oldText, newText);

    expect(result.deletions).toBe(1);
    expect(result.additions).toBe(2);
  });

  it('menangani teks kosong dengan benar', () => {
    const result = computeLineDiff('', 'Baris Baru');
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(0);

    const result2 = computeLineDiff('Baris Dihapus', '');
    expect(result2.deletions).toBe(1);
    expect(result2.additions).toBe(0);
  });
});
