<script lang="ts">
  import { flip } from 'svelte/animate';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { DropdownMenu } from 'bits-ui';
  import Plus from '@lucide/svelte/icons/plus';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import X from '@lucide/svelte/icons/x';
  import CardItem from './CardItem.svelte';
  import InlineEdit from './InlineEdit.svelte';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card, List } from '../lib/types';

  let {
    list,
    store,
    isFirst,
    isLast,
    onopen,
    ondelete,
  }: {
    list: List;
    store: BoardStore;
    isFirst: boolean;
    isLast: boolean;
    onopen: (id: string) => void;
    ondelete: (list: List) => void;
  } = $props();

  const FLIP_MS = 150;
  let items = $state.raw<Card[]>([]);
  let dragging = $state(false);
  let adding = $state(false);
  let newTitle = $state('');

  // Sinkronkan dari store kecuali saat sedang drag (svelte-dnd-action mengelola urutan sementara).
  $effect(() => {
    const fresh = store.cardsFor(list.id);
    if (!dragging) items = fresh;
  });

  function consider(e: CustomEvent<DndEvent<Card>>) {
    dragging = true;
    items = e.detail.items;
  }

  function finalize(e: CustomEvent<DndEvent<Card>>) {
    items = e.detail.items;
    const id = String(e.detail.info.id);
    const index = items.findIndex((c) => c.id === id);
    // Hanya zona tujuan yang memuat kartu → zona asal cukup selesai drag.
    if (index !== -1) store.moveCard(id, list.id, index);
    dragging = false;
  }

  async function addCard(e: SubmitEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    newTitle = '';
    await store.addCard(list.id, title);
  }
</script>

<section class="flex max-h-full w-72 shrink-0 flex-col rounded-2xl bg-slate-200/80 shadow-sm">
  <header class="flex items-center gap-1 px-3 pt-3 pb-2">
    <InlineEdit
      value={list.title}
      class="min-w-0 flex-1 text-sm font-semibold text-slate-800"
      onsave={(title) => store.updateList(list.id, { title })}
    />
    <span class="rounded-full bg-slate-300/70 px-2 text-xs text-slate-600">{items.length}</span>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="rounded-md p-1 text-slate-500 hover:bg-slate-300/60 hover:text-slate-800">
        <Ellipsis class="size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu-content" align="end" sideOffset={4}>
          <DropdownMenu.Item class="menu-item" disabled={isFirst} onSelect={() => store.shiftList(list.id, -1)}>
            <ArrowLeft class="size-4" /> Geser ke kiri
          </DropdownMenu.Item>
          <DropdownMenu.Item class="menu-item" disabled={isLast} onSelect={() => store.shiftList(list.id, 1)}>
            <ArrowRight class="size-4" /> Geser ke kanan
          </DropdownMenu.Item>
          <DropdownMenu.Separator class="my-1 h-px bg-slate-200" />
          <DropdownMenu.Item class="menu-item text-red-600" onSelect={() => ondelete(list)}>
            <Trash2 class="size-4" /> Hapus list
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </header>

  <div
    class="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
    use:dndzone={{ items, flipDurationMs: FLIP_MS, type: 'cards', dropTargetStyle: {} }}
    onconsider={consider}
    onfinalize={finalize}
  >
    {#each items as card (card.id)}
      <div animate:flip={{ duration: FLIP_MS }}>
        <CardItem {card} {onopen} />
      </div>
    {/each}
  </div>

  <footer class="px-2 pb-2">
    {#if adding}
      <form onsubmit={addCard} class="space-y-2">
        <!-- svelte-ignore a11y_autofocus -->
        <textarea
          class="input min-h-16 resize-none"
          placeholder="Judul kartu…"
          bind:value={newTitle}
          autofocus
          onkeydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
            if (e.key === 'Escape') adding = false;
          }}
        ></textarea>
        <div class="flex items-center gap-2">
          <button class="btn-primary" type="submit">Tambah kartu</button>
          <button class="btn-ghost p-1.5" type="button" onclick={() => (adding = false)} aria-label="Batal">
            <X class="size-4" />
          </button>
        </div>
      </form>
    {:else}
      <button class="btn-ghost w-full justify-start" onclick={() => (adding = true)}>
        <Plus class="size-4" /> Tambah kartu
      </button>
    {/if}
  </footer>
</section>
