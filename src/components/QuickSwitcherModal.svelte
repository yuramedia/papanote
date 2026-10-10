<script lang="ts">
  import { Dialog } from 'bits-ui';
  import Search from '@lucide/svelte/icons/search';
  import StickyNote from '@lucide/svelte/icons/sticky-note';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import CornerDownLeft from '@lucide/svelte/icons/corner-down-left';
  import X from '@lucide/svelte/icons/x';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';

  let {
    open = $bindable(false),
    store,
    onselect,
  }: {
    open?: boolean;
    store: BoardStore;
    onselect: (cardId: string) => void;
  } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  const activeCards = $derived(store.cards.filter((c) => !c.deleted_at));

  const filteredCards = $derived.by<Card[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeCards.slice(0, 10);
    return activeCards
      .filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.content && c.content.toLowerCase().includes(q))
      )
      .slice(0, 10);
  });

  $effect(() => {
    if (open) {
      query = '';
      selectedIndex = 0;
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  $effect(() => {
    // Reset selectedIndex saat hasil pencarian berubah
    if (selectedIndex >= filteredCards.length) {
      selectedIndex = Math.max(0, filteredCards.length - 1);
    }
  });

  function getListTitle(listId: string): string {
    return store.lists.find((l) => l.id === listId)?.title ?? 'List';
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (filteredCards.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredCards.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredCards.length) % filteredCards.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = filteredCards[selectedIndex];
      if (chosen) {
        open = false;
        onselect(chosen.id);
      }
    }
  }

  function selectCard(cardId: string) {
    open = false;
    onselect(cardId);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150" />
    <Dialog.Content
      class="fixed left-1/2 top-1/4 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-0 rounded-2xl border border-slate-700 bg-slate-900 p-0 text-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <div class="relative flex items-center border-b border-white/10 px-4 py-3.5">
        <Search class="size-5 text-indigo-400 shrink-0" />
        <input
          type="text"
          bind:this={inputEl}
          bind:value={query}
          onkeydown={handleKeyDown}
          placeholder="Cari catatan di papan... (Ketik judul atau isi)"
          class="w-full bg-transparent px-3 text-sm text-white placeholder-white/40 focus:outline-none"
        />
        {#if query}
          <button
            type="button"
            onclick={() => (query = '')}
            class="text-white/40 hover:text-white transition-colors cursor-pointer mr-1"
          >
            <X class="size-4" />
          </button>
        {/if}
        <span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50 font-mono">ESC</span>
      </div>

      <div class="max-h-80 overflow-y-auto p-2 space-y-1">
        {#if filteredCards.length === 0}
          <div class="py-8 text-center text-xs text-white/40">
            Tidak ada catatan yang cocok dengan "{query}".
          </div>
        {:else}
          {#each filteredCards as card, idx (card.id)}
            <button
              type="button"
              onclick={() => selectCard(card.id)}
              onmouseenter={() => (selectedIndex = idx)}
              class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors cursor-pointer {selectedIndex === idx
                ? 'bg-indigo-600 text-white'
                : 'text-white/80 hover:bg-white/5'}"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <StickyNote class="size-4 {selectedIndex === idx ? 'text-white' : 'text-indigo-400'} shrink-0" />
                <span class="font-medium truncate">{card.title}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="rounded px-2 py-0.5 text-[10px] {selectedIndex === idx ? 'bg-indigo-700/60 text-white/90' : 'bg-white/10 text-white/60'}">
                  {getListTitle(card.list_id)}
                </span>
                {#if selectedIndex === idx}
                  <CornerDownLeft class="size-3 text-white/70" />
                {/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <div class="flex items-center justify-between border-t border-white/10 bg-slate-950/60 px-4 py-2 text-[11px] text-white/40">
        <div class="flex items-center gap-3">
          <span><kbd class="font-mono bg-white/10 px-1 rounded">↑</kbd> <kbd class="font-mono bg-white/10 px-1 rounded">↓</kbd> Navigasi</span>
          <span><kbd class="font-mono bg-white/10 px-1 rounded">↵</kbd> Buka</span>
        </div>
        <span>Quick Switcher</span>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
