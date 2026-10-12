import type { Card, List } from './types';
import { extractTags, filterCardsByTags } from './tags';

export type TableSortColumn = 'title' | 'list' | 'deadline' | 'created';
export type TableSortDirection = 'asc' | 'desc';

export interface TableFilterOptions {
  query?: string;
  listId?: string | 'all';
  activeTags?: string[];
}

/**
 * Memfilter kartu untuk Table View berdasarkan teks pencarian, list terpilih, dan tagar aktif.
 */
export function filterTableCards(
  cards: Card[],
  options: TableFilterOptions,
  lists: List[]
): Card[] {
  let result = cards.filter((c) => !c.deleted_at);

  // 1. Filter per List ID
  if (options.listId && options.listId !== 'all') {
    result = result.filter((c) => c.list_id === options.listId);
  }

  // 2. Filter berdasarkan tagar aktif
  if (options.activeTags && options.activeTags.length > 0) {
    result = filterCardsByTags(result, options.activeTags);
  }

  // 3. Filter query teks (judul, badan isi markdown, tagar, dan nama list)
  const q = options.query?.trim().toLowerCase();
  if (q) {
    const listMap = new Map(lists.map((l) => [l.id, l.title.toLowerCase()]));
    result = result.filter((c) => {
      const titleMatch = c.title.toLowerCase().includes(q);
      const contentMatch = (c.content || '').toLowerCase().includes(q);
      const listMatch = (listMap.get(c.list_id) || '').includes(q);
      const tags = extractTags(c.content);
      const tagMatch = tags.some((t) => t.includes(q) || `#${t}`.includes(q));
      return titleMatch || contentMatch || listMatch || tagMatch;
    });
  }

  return result;
}

/**
 * Mengurutkan kartu untuk Table View berdasarkan kolom dan arah (ASC/DESC).
 */
export function sortTableCards(
  cards: Card[],
  column: TableSortColumn,
  direction: TableSortDirection,
  lists: List[]
): Card[] {
  const listOrder = new Map(lists.map((l, idx) => [l.id, idx]));
  const modifier = direction === 'asc' ? 1 : -1;

  return [...cards].sort((a, b) => {
    switch (column) {
      case 'title':
        return modifier * a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      case 'list': {
        const orderA = listOrder.get(a.list_id) ?? 999;
        const orderB = listOrder.get(b.list_id) ?? 999;
        return modifier * (orderA - orderB);
      }
      case 'deadline': {
        if (!a.deadline_date && !b.deadline_date) return 0;
        if (!a.deadline_date) return 1; // null diletakkan di akhir
        if (!b.deadline_date) return -1;
        const timeA = new Date(a.deadline_date).getTime();
        const timeB = new Date(b.deadline_date).getTime();
        return modifier * (timeA - timeB);
      }
      case 'created': {
        const timeA = new Date(a.uploaded_at || 0).getTime();
        const timeB = new Date(b.uploaded_at || 0).getTime();
        return modifier * (timeA - timeB);
      }
      default:
        return 0;
    }
  });
}
