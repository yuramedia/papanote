<script lang="ts">
  import FileText from '@lucide/svelte/icons/file-text';
  import Calendar from '@lucide/svelte/icons/calendar';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';
  import { formatDateTime } from '../lib/format';
  import { renderMarkdown } from '../lib/markdown';

  let {
    targetCard,
    store,
    position,
    visible,
    onopen,
    onmouseenter,
    onmouseleave,
  }: {
    targetCard: Card | null;
    store: BoardStore;
    position: { x: number; y: number; placeAbove?: boolean };
    visible: boolean;
    onopen: (cardId: string) => void;
    onmouseenter?: () => void;
    onmouseleave?: () => void;
  } = $props();

  const LIST_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#f97316', // Orange
    '#14b8a6', // Teal
  ];

  function getListColor(listId: string): string {
    const idx = store.lists.findIndex((l) => l.id === listId);
    if (idx === -1) return '#64748b';
    return LIST_COLORS[idx % LIST_COLORS.length];
  }

  function getListTitle(listId: string): string {
    return store.lists.find((l) => l.id === listId)?.title ?? 'List';
  }
</script>

{#if visible && targetCard}
  <!-- Popover Container Melayang (Obsidian Hover Preview) -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-50 w-84 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-xl transition-all duration-150 animate-in fade-in-0 zoom-in-95"
    style="left: {position.x}px; top: {position.y}px; transform: {position.placeAbove ? 'translateY(-100%)' : 'none'};"
    {onmouseenter}
    {onmouseleave}
  >
    <!-- Header Popover -->
    <div class="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
      <div class="flex items-center gap-2 min-w-0">
        <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
          <FileText class="size-4" />
        </div>
        <div class="min-w-0">
          <h4 class="text-xs font-semibold text-white truncate leading-snug">
            {targetCard.title}
          </h4>
          <span
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-medium tracking-wide mt-0.5"
            style="background-color: {getListColor(targetCard.list_id)}20; color: {getListColor(targetCard.list_id)};"
          >
            <span class="size-1.5 rounded-full" style="background-color: {getListColor(targetCard.list_id)}"></span>
            {getListTitle(targetCard.list_id)}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer shrink-0"
        onclick={() => onopen(targetCard.id)}
        title="Buka Catatan Lengkap"
      >
        <span>Buka</span>
        <ArrowUpRight class="size-3" />
      </button>
    </div>

    <!-- Pratinjau Isi Catatan -->
    <div class="mt-2.5 max-h-36 overflow-y-auto pr-1 text-[11px] leading-relaxed text-white/70">
      {#if targetCard.content}
        <div class="prose prose-invert prose-xs line-clamp-4">
          {@html renderMarkdown(targetCard.content)}
        </div>
      {:else}
        <p class="italic text-white/40">Catatan ini masih kosong.</p>
      {/if}
    </div>

    <!-- Footer Popover: Deadline & Petunjuk -->
    <div class="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-white/40">
      {#if targetCard.deadline_date}
        <span class="flex items-center gap-1 text-amber-400/90 font-medium truncate">
          <Calendar class="size-3" />
          {formatDateTime(targetCard.deadline_date).slice(0, 16)}
        </span>
      {:else}
        <span>Tanpa tenggat waktu</span>
      {/if}

      <span class="text-indigo-400/80">Obsidian Preview</span>
    </div>
  </div>
{/if}
