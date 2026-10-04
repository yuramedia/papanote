/**
 * Fractional indexing berbasis float.
 * Memindahkan item cukup menghitung nilai tengah antara tetangganya — hanya SATU baris
 * yang di-update di database, bukan seluruh list.
 */
export const STEP = 1024;
/** Batas presisi: jika celah lebih kecil dari ini, list perlu di-rebalance. */
export const MIN_GAP = 1e-9;

/** Posisi baru di antara prev dan next (keduanya opsional: awal/akhir list). */
export function positionBetween(prev?: number | null, next?: number | null): number {
  const hasPrev = prev != null;
  const hasNext = next != null;
  if (!hasPrev && !hasNext) return STEP;
  if (!hasPrev) return next! / 2;
  if (!hasNext) return prev! + STEP;
  return (prev! + next!) / 2;
}

/** True jika presisi float sudah habis sehingga nilai tengah tidak lagi unik. */
export function needsRebalance(prev?: number | null, next?: number | null): boolean {
  if (prev != null && next != null) {
    if (next - prev < MIN_GAP) return true;
  }
  if (prev == null && next != null && next < MIN_GAP) return true;
  const mid = positionBetween(prev, next);
  return (prev != null && mid <= prev) || (next != null && mid >= next);
}

/** Posisi berjarak rata untuk n item (dipakai saat rebalance). */
export function evenPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * STEP);
}

/** Posisi untuk item yang ditempatkan di index tertentu dalam array terurut (tanpa item itu sendiri). */
export function positionAtIndex(sortedPositions: number[], index: number): number {
  const prev = index > 0 ? sortedPositions[index - 1] : null;
  const next = index < sortedPositions.length ? sortedPositions[index] : null;
  return positionBetween(prev, next);
}
