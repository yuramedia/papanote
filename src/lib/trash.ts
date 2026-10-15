import { supabase } from './supabase';
import type { Card, List } from './types';

export interface TrashCardItem extends Card {
  listTitle: string;
  isListDeleted: boolean;
}

export interface TrashListItem extends List {
  cardCount: number;
}

export interface BoardTrashSummary {
  cards: TrashCardItem[];
  lists: TrashListItem[];
}

/**
 * Format waktu relatif untuk item terhapus dalam bahasa Indonesia.
 */
export function formatDeletedRelativeTime(dateString: string | null | undefined, now = new Date()): string {
  if (!dateString) return 'Tidak diketahui';
  const d = new Date(dateString);
  const diffMs = now.getTime() - d.getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Baru saja';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Baru saja';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit yang lalu`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam yang lalu`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`;

  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Menentukan list tujuan pemulihan kartu.
 * Jika list asal masih ada dan aktif, gunakan list asal.
 * Jika list asal sudah dihapus atau tidak ditemukan, fallback ke list aktif pertama.
 */
export function resolveRestoreListId(
  card: Card,
  activeLists: List[],
  fallbackListId?: string,
): string | null {
  const isOriginalActive = activeLists.some((l) => l.id === card.list_id && !l.deleted_at);
  if (isOriginalActive) return card.list_id;
  if (fallbackListId && activeLists.some((l) => l.id === fallbackListId && !l.deleted_at)) {
    return fallbackListId;
  }
  return activeLists.find((l) => !l.deleted_at)?.id ?? null;
}

/**
 * Filter kartu di kotak sampah berdasarkan teks judul, isi catatan, atau nama list asal.
 */
export function filterTrashCards(cards: TrashCardItem[], query: string): TrashCardItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      (c.content && c.content.toLowerCase().includes(q)) ||
      c.listTitle.toLowerCase().includes(q),
  );
}

/**
 * Filter list di kotak sampah berdasarkan judul list.
 */
export function filterTrashLists(lists: TrashListItem[], query: string): TrashListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return lists;
  return lists.filter((l) => l.title.toLowerCase().includes(q));
}

/**
 * Ambil semua catatan dan list yang berada di kotak sampah (soft-deleted) untuk suatu papan.
 */
export async function fetchBoardTrash(boardId: string): Promise<BoardTrashSummary> {
  const sb = supabase();
  // Ambil semua list (baik aktif maupun soft-deleted) untuk pemetaan judul dan relasi
  const { data: allLists, error: listErr } = await sb
    .from('lists')
    .select('*')
    .eq('board_id', boardId);
  if (listErr) throw listErr;

  const listsData: List[] = allLists ?? [];
  const listIds = listsData.map((l) => l.id);

  if (listIds.length === 0) {
    return { cards: [], lists: [] };
  }

  // Ambil kartu yang berstatus soft-deleted
  const { data: deletedCardsData, error: cardErr } = await sb
    .from('cards')
    .select('*')
    .in('list_id', listIds)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (cardErr) throw cardErr;

  const deletedCards: Card[] = deletedCardsData ?? [];

  // List yang berstatus soft-deleted
  const deletedListsRaw = listsData.filter((l) => l.deleted_at !== null);
  const lists: TrashListItem[] = deletedListsRaw.map((l) => {
    const cardCount = deletedCards.filter((c) => c.list_id === l.id).length;
    return { ...l, cardCount };
  });

  const cards: TrashCardItem[] = deletedCards.map((c) => {
    const parentList = listsData.find((l) => l.id === c.list_id);
    return {
      ...c,
      listTitle: parentList?.title ?? 'List Tak Dikenal',
      isListDeleted: !!parentList?.deleted_at,
    };
  });

  return { cards, lists };
}

/**
 * Pulihkan kartu terhapus ke list tujuan (atau list aslinya).
 */
export async function restoreCardDb(cardId: string, targetListId: string): Promise<boolean> {
  const sb = supabase();
  const now = new Date().toISOString();
  const { error } = await sb
    .from('cards')
    .update({ deleted_at: null, list_id: targetListId, updated_at: now })
    .eq('id', cardId);
  return !error;
}

/**
 * Pulihkan list terhapus, dengan opsi memulihkan seluruh kartu di dalamnya.
 */
export async function restoreListDb(listId: string, restoreChildCards = true): Promise<boolean> {
  const sb = supabase();
  const now = new Date().toISOString();
  const { error: listErr } = await sb
    .from('lists')
    .update({ deleted_at: null, updated_at: now })
    .eq('id', listId);
  if (listErr) return false;

  if (restoreChildCards) {
    await sb
      .from('cards')
      .update({ deleted_at: null, updated_at: now })
      .eq('list_id', listId);
  }
  return true;
}

/**
 * Hapus kartu secara permanen dari database.
 */
export async function permanentDeleteCardDb(cardId: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('cards').delete().eq('id', cardId);
  return !error;
}

/**
 * Hapus list secara permanen dari database. (Cascade delete kartu & history).
 */
export async function permanentDeleteListDb(listId: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('lists').delete().eq('id', listId);
  return !error;
}

/**
 * Kosongkan seluruh kotak sampah untuk papan ini secara permanen.
 */
export async function emptyBoardTrashDb(boardId: string): Promise<boolean> {
  const sb = supabase();
  const { data: allLists } = await sb.from('lists').select('id, deleted_at').eq('board_id', boardId);
  const lists = allLists ?? [];
  const listIds = lists.map((l) => l.id);
  const deletedListIds = lists.filter((l) => l.deleted_at !== null).map((l) => l.id);

  if (listIds.length > 0) {
    await sb.from('cards').delete().in('list_id', listIds).not('deleted_at', 'is', null);
  }
  if (deletedListIds.length > 0) {
    await sb.from('lists').delete().in('id', deletedListIds);
  }
  return true;
}

/**
 * Pulihkan semua item (list dan kartu) di kotak sampah untuk papan ini.
 */
export async function restoreAllBoardTrashDb(boardId: string): Promise<boolean> {
  const sb = supabase();
  const now = new Date().toISOString();
  // 1. Pulihkan semua list yang terhapus
  await sb
    .from('lists')
    .update({ deleted_at: null, updated_at: now })
    .eq('board_id', boardId)
    .not('deleted_at', 'is', null);

  // 2. Ambil semua list
  const { data: lists } = await sb.from('lists').select('id').eq('board_id', boardId);
  const listIds = (lists ?? []).map((l) => l.id);
  if (listIds.length > 0) {
    // 3. Pulihkan semua kartu yang terhapus
    await sb
      .from('cards')
      .update({ deleted_at: null, updated_at: now })
      .in('list_id', listIds)
      .not('deleted_at', 'is', null);
  }
  return true;
}
