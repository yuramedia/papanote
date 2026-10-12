import { describe, it, expect } from 'bun:test';
import {
  formatPomodoroTime,
  calculateProgress,
  formatSessionLogMarkdown,
  MODE_DURATIONS,
  MODE_LABELS,
  MODE_ICONS,
} from '../src/lib/pomodoro';

describe('Sistem Pomodoro & Focus Timer', () => {
  describe('formatPomodoroTime', () => {
    it('memformat detik menjadi mm:ss dengan leading zero', () => {
      expect(formatPomodoroTime(1500)).toBe('25:00');
      expect(formatPomodoroTime(300)).toBe('05:00');
      expect(formatPomodoroTime(45)).toBe('00:45');
      expect(formatPomodoroTime(5)).toBe('00:05');
      expect(formatPomodoroTime(0)).toBe('00:00');
    });

    it('menangani input negatif atau NaN dengan aman', () => {
      expect(formatPomodoroTime(-10)).toBe('00:00');
      expect(formatPomodoroTime(NaN)).toBe('00:00');
    });
  });

  describe('calculateProgress', () => {
    it('menghitung persentase progres secara akurat', () => {
      // Total 100 detik, sisa 100 -> 0%
      expect(calculateProgress(100, 100)).toBe(0);
      // Total 100 detik, sisa 50 -> 50%
      expect(calculateProgress(50, 100)).toBe(50);
      // Total 100 detik, sisa 0 -> 100%
      expect(calculateProgress(0, 100)).toBe(100);
      // Mode 25 menit (1500s), sisa 750s -> 50%
      expect(calculateProgress(750, 1500)).toBe(50);
    });

    it('membatasi hasil dalam rentang 0 sampai 100', () => {
      expect(calculateProgress(-10, 100)).toBe(100);
      expect(calculateProgress(200, 100)).toBe(0);
      expect(calculateProgress(50, 0)).toBe(0);
    });
  });

  describe('formatSessionLogMarkdown', () => {
    it('menghasilkan blok kutipan log sesi dengan ikon dan waktu bahasa Indonesia', () => {
      const fixedDate = new Date(2026, 9, 12, 14, 30);
      const log = formatSessionLogMarkdown({
        durationMinutes: 25,
        date: fixedDate,
        mode: 'focus',
      });

      expect(log).toContain('> 🍅 **Fokus Kerja:** 25 menit');
      expect(log).toContain('12 Okt 2026 14:30 WIB');
    });

    it('mendukung mode istirahat singkat dan istirahat panjang', () => {
      const fixedDate = new Date(2026, 9, 12, 15, 0);
      const breakLog = formatSessionLogMarkdown({
        durationMinutes: 5,
        date: fixedDate,
        mode: 'short_break',
      });

      expect(breakLog).toContain('> ☕ **Istirahat Singkat:** 5 menit');
    });
  });

  describe('Durasi dan Label Bawaan', () => {
    it('memiliki durasi standar Pomodoro (25m fokus, 5m break, 15m long break)', () => {
      expect(MODE_DURATIONS.focus).toBe(1500);
      expect(MODE_DURATIONS.short_break).toBe(300);
      expect(MODE_DURATIONS.long_break).toBe(900);
    });

    it('memiliki label dan ikon untuk setiap mode', () => {
      expect(MODE_LABELS.focus).toBe('Fokus Kerja');
      expect(MODE_LABELS.short_break).toBe('Istirahat Singkat');
      expect(MODE_LABELS.long_break).toBe('Istirahat Panjang');

      expect(MODE_ICONS.focus).toBe('🍅');
      expect(MODE_ICONS.short_break).toBe('☕');
      expect(MODE_ICONS.long_break).toBe('🛋️');
    });
  });
});
