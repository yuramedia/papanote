/** Gabungkan baris dari realtime/server ke state lokal dengan aturan last-write-wins. */
export interface Versioned {
  id: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Kembalikan array baru setelah menerapkan `row`:
 * - deleted_at terisi → item dibuang dari tampilan
 * - item lokal lebih baru (updated_at lebih besar) → diabaikan (hindari "loncat balik" saat optimistic update)
 * - selain itu → insert / replace
 */
export function mergeRow<T extends Versioned>(items: T[], row: T): T[] {
  const idx = items.findIndex((i) => i.id === row.id);
  if (row.deleted_at) {
    return idx === -1 ? items : items.filter((i) => i.id !== row.id);
  }
  if (idx === -1) return [...items, row];
  const current = items[idx];
  if (new Date(current.updated_at).getTime() > new Date(row.updated_at).getTime()) return items;
  const next = items.slice();
  next[idx] = row;
  return next;
}

export function byPosition<T extends { position: number }>(a: T, b: T): number {
  return a.position - b.position;
}
