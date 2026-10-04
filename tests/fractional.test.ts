import { describe, expect, test } from 'bun:test';
import { evenPositions, needsRebalance, positionAtIndex, positionBetween, STEP } from '../src/lib/fractional';

describe('positionBetween', () => {
  test('list kosong → STEP', () => {
    expect(positionBetween()).toBe(STEP);
  });
  test('di akhir list → prev + STEP', () => {
    expect(positionBetween(2048, null)).toBe(2048 + STEP);
  });
  test('di awal list → setengah dari next', () => {
    expect(positionBetween(null, 1024)).toBe(512);
  });
  test('di antara dua kartu → nilai tengah', () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });
  test('hasil selalu berada di antara tetangga', () => {
    let lo = 1;
    let hi = 2;
    for (let i = 0; i < 30; i++) {
      const mid = positionBetween(lo, hi);
      expect(mid).toBeGreaterThan(lo);
      expect(mid).toBeLessThan(hi);
      hi = mid;
    }
  });
});

describe('needsRebalance', () => {
  test('celah normal → tidak perlu', () => {
    expect(needsRebalance(1024, 2048)).toBe(false);
    expect(needsRebalance(null, 1024)).toBe(false);
    expect(needsRebalance(1024, null)).toBe(false);
    expect(needsRebalance(null, null)).toBe(false);
  });
  test('presisi float habis → perlu rebalance', () => {
    let lo = 1;
    let hi = 2;
    let iterations = 0;
    while (!needsRebalance(lo, hi) && iterations < 200) {
      hi = positionBetween(lo, hi);
      iterations++;
    }
    expect(iterations).toBeLessThan(200);
    expect(needsRebalance(lo, hi)).toBe(true);
  });
});

describe('evenPositions & positionAtIndex', () => {
  test('evenPositions berjarak STEP', () => {
    expect(evenPositions(3)).toEqual([STEP, 2 * STEP, 3 * STEP]);
  });
  test('positionAtIndex menyisipkan di index yang benar', () => {
    const sorted = [1024, 2048, 3072];
    expect(positionAtIndex(sorted, 0)).toBe(512);
    expect(positionAtIndex(sorted, 1)).toBe(1536);
    expect(positionAtIndex(sorted, 3)).toBe(3072 + STEP);
  });
});
