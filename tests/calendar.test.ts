import { describe, expect, it } from 'bun:test';
import {
  toDateKey,
  getMonthDays,
  getWeekDays,
  updateDateKeepingTime,
  MONTH_NAMES_ID,
  DAY_NAMES_ID,
} from '../src/lib/calendar';

describe('calendar helpers', () => {
  it('toDateKey menghasilkan format YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 12); // Oktober 12, 2026
    expect(toDateKey(d)).toBe('2026-10-12');
  });

  it('getMonthDays menghasilkan kelipatan 7 hari dan mencakup seluruh hari bulan itu', () => {
    const days = getMonthDays(2026, 9); // Oktober 2026 (31 hari)
    expect(days.length % 7).toBe(0);
    expect(days.length).toBeGreaterThanOrEqual(35);

    const currentMonthDays = days.filter((d) => d.isCurrentMonth);
    expect(currentMonthDays.length).toBe(31);
    expect(currentMonthDays[0].dayNumber).toBe(1);
    expect(currentMonthDays[30].dayNumber).toBe(31);
  });

  it('getWeekDays selalu menghasilkan tepat 7 hari mulai dari Senin', () => {
    const ref = new Date(2026, 9, 14); // Rabu 14 Okt 2026
    const week = getWeekDays(ref);
    expect(week.length).toBe(7);
    // Hari pertama harus Senin (12 Okt 2026)
    expect(week[0].dateKey).toBe('2026-10-12');
    expect(week[6].dateKey).toBe('2026-10-18');
  });

  it('updateDateKeepingTime mempertahankan jam & menit yang sudah ada', () => {
    const original = new Date(2026, 9, 5, 14, 30, 0).toISOString();
    const updated = updateDateKeepingTime(original, '2026-10-25');
    const updatedDate = new Date(updated);

    expect(updatedDate.getFullYear()).toBe(2026);
    expect(updatedDate.getMonth()).toBe(9); // Oktober
    expect(updatedDate.getDate()).toBe(25);
    expect(updatedDate.getHours()).toBe(14);
    expect(updatedDate.getMinutes()).toBe(30);
  });

  it('updateDateKeepingTime memberikan default 23:59 jika sebelumnya null', () => {
    const updated = updateDateKeepingTime(null, '2026-11-01');
    const updatedDate = new Date(updated);

    expect(updatedDate.getFullYear()).toBe(2026);
    expect(updatedDate.getMonth()).toBe(10); // November
    expect(updatedDate.getDate()).toBe(1);
    expect(updatedDate.getHours()).toBe(23);
    expect(updatedDate.getMinutes()).toBe(59);
  });

  it('nama bulan dan hari berbahasa Indonesia', () => {
    expect(MONTH_NAMES_ID[9]).toBe('Oktober');
    expect(DAY_NAMES_ID[0]).toBe('Senin');
  });
});
