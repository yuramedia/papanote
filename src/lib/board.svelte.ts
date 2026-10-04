import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { auth } from './auth.svelte';
import { toast } from './toast.svelte';
import { byPosition, mergeRow } from './merge';
import { evenPositions, needsRebalance, positionBetween } from './fractional';
import type { Board, Card, List } from './types';

const nowIso = () => new Date().toISOString();

/** State satu papan + sinkronisasi realtime Supabase. */
export class BoardStore {
  board = $state<Board | null>(null);
  lists = $state<List[]>([]);
  cards = $state<Card[]>([]);
  loading = $state(true);
  error = $state<string | null>(null);
  connected = $state(false);

  sortedLists = $derived([...this.lists].sort(byPosition));

  #channel: RealtimeChannel | null = null;
  #boardId: string;

  constructor(boardId: string) {
    this.#boardId = boardId;
  }

  cardsFor(listId: string): Card[] {
    return this.cards.filter((c) => c.list_id === listId).sort(byPosition);
  }

  findCard(id: string): Card | undefined {
    return this.cards.find((c) => c.id === id);
  }

  async load() {
    const sb = supabase();
    this.loading = true;
    this.error = null;
    try {
      const { data: board, error: e1 } = await sb
        .from('boards').select('*').eq('id', this.#boardId).is('deleted_at', null).maybeSingle();
      if (e1) throw e1;
      if (!board) throw new Error('Papan tidak ditemukan atau sudah dihapus.');
      const { data: lists, error: e2 } = await sb
        .from('lists').select('*').eq('board_id', this.#boardId).is('deleted_at', null);
      if (e2) throw e2;
      const listIds = (lists ?? []).map((l) => l.id);
      let cards: Card[] = [];
      if (listIds.length) {
        const { data, error: e3 } = await sb
          .from('cards').select('*').in('list_id', listIds).is('deleted_at', null);
        if (e3) throw e3;
        cards = data ?? [];
      }
      this.board = board;
      this.lists = lists ?? [];
      this.cards = cards;
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
    this.#subscribe();
  }

  #subscribe() {
    const sb = supabase();
    this.#channel?.unsubscribe();
    this.#channel = sb
      .channel(`board:${this.#boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards', filter: `id=eq.${this.#boardId}` },
        (p) => {
          const row = p.new as Board;
          if (!row?.id) return;
          if (row.deleted_at) {
            this.error = 'Papan ini telah dihapus.';
          }
          this.board = row;
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists', filter: `board_id=eq.${this.#boardId}` },
        (p) => {
          const row = p.new as List;
          if (row?.id) this.lists = mergeRow(this.lists, row);
        })
      // cards tidak punya board_id → filter di klien berdasarkan list milik papan ini
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, (p) => {
        const row = p.new as Card;
        if (!row?.id) return;
        const belongs = this.lists.some((l) => l.id === row.list_id);
        if (belongs) this.cards = mergeRow(this.cards, row);
        else if (this.cards.some((c) => c.id === row.id)) {
          // dipindah ke papan lain
          this.cards = this.cards.filter((c) => c.id !== row.id);
        }
      })
      .subscribe((status) => {
        this.connected = status === 'SUBSCRIBED';
      });
  }

  destroy() {
    this.#channel?.unsubscribe();
    this.#channel = null;
  }

  // ---------- Lists ----------

  async addList(title: string) {
    const last = this.sortedLists.at(-1);
    const list: List = {
      id: crypto.randomUUID(),
      board_id: this.#boardId,
      title,
      position: positionBetween(last?.position, null),
      deleted_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    this.lists = [...this.lists, list];
    const { id, board_id, title: t, position } = list;
    const { error } = await supabase().from('lists').insert({ id, board_id, title: t, position });
    if (error) {
      this.lists = this.lists.filter((l) => l.id !== list.id);
      toast.error(`Gagal membuat list: ${error.message}`);
    }
  }

  async updateList(id: string, patch: Partial<Pick<List, 'title' | 'position' | 'deleted_at'>>) {
    const before = this.lists.find((l) => l.id === id);
    if (!before) return;
    this.lists = this.lists.map((l) => (l.id === id ? { ...l, ...patch, updated_at: nowIso() } : l));
    if (patch.deleted_at) this.lists = this.lists.filter((l) => l.id !== id);
    const { error } = await supabase().from('lists').update(patch).eq('id', id);
    if (error) {
      this.lists = mergeRow(this.lists.filter((l) => l.id !== id), { ...before, updated_at: nowIso() });
      toast.error(`Gagal menyimpan list: ${error.message}`);
    }
  }

  /** Geser list ke kiri (-1) / kanan (+1) menggunakan fractional indexing. */
  async shiftList(id: string, dir: -1 | 1) {
    const sorted = this.sortedLists;
    const idx = sorted.findIndex((l) => l.id === id);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= sorted.length) return;
    const others = sorted.filter((l) => l.id !== id);
    const prev = others[target - 1]?.position ?? null;
    const next = others[target]?.position ?? null;
    await this.updateList(id, { position: positionBetween(prev, next) });
  }

  // ---------- Cards ----------

  async addCard(listId: string, title: string) {
    const last = this.cardsFor(listId).at(-1);
    const userId = auth.user?.id ?? null;
    const card: Card = {
      id: crypto.randomUUID(),
      list_id: listId,
      title,
      content: '',
      position: positionBetween(last?.position, null),
      deadline_date: null,
      enable_notification: false,
      created_by: userId,
      updated_by: userId,
      deleted_at: null,
      uploaded_at: nowIso(),
      updated_at: nowIso(),
    };
    this.cards = [...this.cards, card];
    const { error } = await supabase().from('cards').insert({
      id: card.id,
      list_id: card.list_id,
      title: card.title,
      position: card.position,
      created_by: userId,
      updated_by: userId,
    });
    if (error) {
      this.cards = this.cards.filter((c) => c.id !== card.id);
      toast.error(`Gagal membuat kartu: ${error.message}`);
    }
  }

  async updateCard(
    id: string,
    patch: Partial<Pick<Card, 'title' | 'content' | 'deadline_date' | 'enable_notification' | 'list_id' | 'position' | 'deleted_at'>>,
  ): Promise<boolean> {
    const before = this.findCard(id);
    if (!before) return false;
    const updated_by = auth.user?.id ?? null;
    this.cards = patch.deleted_at
      ? this.cards.filter((c) => c.id !== id)
      : this.cards.map((c) => (c.id === id ? { ...c, ...patch, updated_by, updated_at: nowIso() } : c));
    const { error } = await supabase().from('cards').update({ ...patch, updated_by }).eq('id', id);
    if (error) {
      this.cards = [...this.cards.filter((c) => c.id !== id), before];
      toast.error(`Gagal menyimpan kartu: ${error.message}`);
      return false;
    }
    return true;
  }

  /**
   * Pindahkan kartu ke listId pada index tertentu. Hanya satu baris yang di-update,
   * kecuali presisi float habis → seluruh list itu di-rebalance (sangat jarang).
   */
  async moveCard(id: string, listId: string, index: number) {
    const others = this.cardsFor(listId).filter((c) => c.id !== id);
    const prev = others[index - 1]?.position ?? null;
    const next = others[index]?.position ?? null;
    if (needsRebalance(prev, next)) {
      await this.#rebalance(listId, id, index);
      return;
    }
    await this.updateCard(id, { list_id: listId, position: positionBetween(prev, next) });
  }

  async #rebalance(listId: string, movingId: string, index: number) {
    const ordered = this.cardsFor(listId).filter((c) => c.id !== movingId);
    const moving = this.findCard(movingId);
    if (moving) ordered.splice(index, 0, moving);
    const positions = evenPositions(ordered.length);
    await Promise.all(
      ordered.map((c, i) => this.updateCard(c.id, { list_id: listId, position: positions[i] })),
    );
  }
}
