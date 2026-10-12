<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import Search from '@lucide/svelte/icons/search';
  import Plus from '@lucide/svelte/icons/plus';
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Filter from '@lucide/svelte/icons/filter';
  import X from '@lucide/svelte/icons/x';
  import StickyNote from '@lucide/svelte/icons/sticky-note';
  import Table2 from '@lucide/svelte/icons/table-2';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Bell from '@lucide/svelte/icons/bell';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';
  import {
    filterTableCards,
    sortTableCards,
    type TableSortColumn,
    type TableSortDirection,
  } from '../lib/table';
  import { extractTags, getTagColor } from '../lib/tags';
  import { extractFirstImage, cleanSnippet } from '../lib/attachments';
  import { deadlineState, formatDate, formatDateTime } from '../lib/format';
  import { toast } from '../lib/toast.svelte';

  let {
    store,
    onopen,
  }: {
    store: BoardStore;
    onopen: (cardId: string) => void;
  } = $props();

  let searchQuery = $state('');
  let selectedListId = $state<string | 'all'>('all');
  let sortColumn = $state<TableSortColumn>('created');
  let sortDirection = $state<TableSortDirection>('desc');

  // Input tambah catatan inline di bagian bawah tabel
  let inlineTitle = $state('');
  let inlineListId = $state<string>('');
  let isAddingInline = $state(false);

  // Dialog konfirmasi hapus kartu
  let cardToDelete = $state<Card | null>(null);
  let confirmDeleteOpen = $state(false);

  // Palet warna penanda list
  const LIST_COLORS = [
    { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: '#6366f1' },
    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#10b981' },
    { bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: '#f59e0b' },
    { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: '#a855f7' },
    { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: '#f43f5e' },
    { bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: '#0ea5e9' },
  ];

  function getListBadgeStyle(listId: string) {
    const idx = store.sortedLists.findIndex((l) => l.id === listId);
    if (idx === -1) return LIST_COLORS[0];
    return LIST_COLORS[idx % LIST_COLORS.length];
  }

  function getListTitle(listId: string): string {
    return store.lists.find((l) => l.id === listId)?.title ?? 'List';
  }

  // Set default inlineListId saat store lists terisi
  $effect(() => {
    if (!inlineListId && store.sortedLists.length > 0) {
      inlineListId = store.sortedLists[0].id;
    }
  });

  // Filter kartu berdasarkan pencarian, list, dan tagar aktif dari papan
  const filteredCards = $derived.by<Card[]>(() => {
    return filterTableCards(
      store.cards,
      {
        query: searchQuery,
        listId: selectedListId,
        activeTags: store.activeTags,
      },
      store.lists,
    );
  });

  // Urutkan kartu
  const sortedCards = $derived.by<Card[]>(() => {
    return sortTableCards(filteredCards, sortColumn, sortDirection, store.lists);
  });

  // Statistik tabel
  const stats = $derived.by(() => {
    const total = sortedCards.length;
    const withDeadline = sortedCards.filter((c) => !!c.deadline_date).length;
    const overdue = sortedCards.filter((c) => deadlineState(c.deadline_date) === 'overdue').length;
    return { total, withDeadline, overdue };
  });

  function toggleSort(col: TableSortColumn) {
    if (sortColumn === col) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDirection = 'asc';
    }
  }

  async function handleMoveCard(cardId: string, newListId: string) {
    if (!newListId) return;
    const success = await store.updateCard(cardId, { list_id: newListId });
    if (success) {
      const targetTitle = getListTitle(newListId);
      toast.success(`Catatan dipindahkan ke "${targetTitle}".`);
    }
  }

  async function handleInlineAdd(e: SubmitEvent) {
    e.preventDefault();
    const title = inlineTitle.trim();
    if (!title) return;

    const listId = inlineListId || store.sortedLists[0]?.id;
    if (!listId) {
      toast.show('Buat list terlebih dahulu sebelum menambah catatan.', 'info');
      return;
    }

    const created = await store.addCard(listId, title);
    if (created) {
      inlineTitle = '';
      isAddingInline = false;
      toast.success(`Catatan "${created.title}" berhasil ditambahkan.`);
    }
  }

  const badgeDeadline = {
    none: '',
    normal: 'bg-slate-100 text-slate-700 border-slate-200',
    soon: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
    overdue: 'bg-red-100 text-red-800 border-red-300 font-semibold',
  } as const;
</script>

<div class="flex h-full w-full flex-col overflow-hidden bg-slate-900/90 backdrop-blur-md text-white select-none">
  <!-- 1. HEADER TOOLBAR TABEL -->
  <header class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/60 px-4 py-3 text-xs shrink-0">
    <div class="flex flex-wrap items-center gap-3">
      <!-- Title & Record Count -->
      <div class="flex items-center gap-2">
        <div class="grid size-7 place-items-center rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
          <Table2 class="size-4" />
        </div>
        <span class="font-semibold text-sm text-white">Database Tabel</span>
        <span class="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70">
          {sortedCards.length} data
        </span>
      </div>

      <!-- Filter List Selector -->
      <div class="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs border border-white/10">
        <Filter class="size-3.5 text-indigo-300 shrink-0" />
        <span class="text-white/60">List:</span>
        <select
          bind:value={selectedListId}
          class="bg-transparent font-medium text-white outline-none cursor-pointer pr-1"
        >
          <option value="all" class="bg-slate-900 text-white">Semua List ({store.cards.length})</option>
          {#each store.sortedLists as list (list.id)}
            {@const count = store.cards.filter((c) => !c.deleted_at && c.list_id === list.id).length}
            <option value={list.id} class="bg-slate-900 text-white">{list.title} ({count})</option>
          {/each}
        </select>
      </div>

      <!-- Quick Search Input -->
      <div class="relative flex items-center">
        <Search class="absolute left-2.5 size-3.5 text-white/40 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari di tabel…"
          bind:value={searchQuery}
          class="w-48 sm:w-60 rounded-lg border border-white/10 bg-white/5 pl-8 pr-7 py-1 text-xs text-white placeholder-white/40 focus:border-indigo-400 focus:bg-white/10 focus:outline-none transition-colors"
        />
        {#if searchQuery}
          <button
            type="button"
            onclick={() => (searchQuery = '')}
            class="absolute right-2 text-white/40 hover:text-white transition-colors cursor-pointer"
            title="Bersihkan pencarian"
          >
            <X class="size-3" />
          </button>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2">
      <!-- Tombol Tambah Catatan Cepat -->
      <button
        type="button"
        onclick={() => (isAddingInline = !isAddingInline)}
        class="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors cursor-pointer"
      >
        <Plus class="size-3.5" />
        <span>+ Tambah Catatan</span>
      </button>
    </div>
  </header>

  <!-- Form Inline Tambah Catatan Cepat (jika aktif) -->
  {#if isAddingInline}
    <div class="border-b border-indigo-500/30 bg-indigo-950/40 px-4 py-2.5 animate-in fade-in-0 duration-150 shrink-0">
      <form onsubmit={handleInlineAdd} class="flex flex-wrap items-center gap-3">
        <span class="text-xs font-medium text-indigo-300 flex items-center gap-1.5">
          <Plus class="size-3.5" />
          Baris Baru:
        </span>
        <input
          type="text"
          placeholder="Judul catatan baru…"
          bind:value={inlineTitle}
          class="flex-1 min-w-[200px] rounded-lg border border-indigo-400/50 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <select
          bind:value={inlineListId}
          class="rounded-lg border border-indigo-400/50 bg-black/40 px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
        >
          {#each store.sortedLists as list (list.id)}
            <option value={list.id} class="bg-slate-900 text-white">List: {list.title}</option>
          {/each}
        </select>
        <button type="submit" class="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white shadow-xs cursor-pointer">
          Simpan Baris
        </button>
        <button
          type="button"
          onclick={() => (isAddingInline = false)}
          class="text-xs text-white/60 hover:text-white cursor-pointer px-1"
        >
          Batal
        </button>
      </form>
    </div>
  {/if}

  <!-- 2. TABEL KARTU (GRID VIEW) -->
  <div class="flex-1 overflow-auto custom-scrollbar">
    <table class="w-full border-collapse text-left text-xs">
      <!-- TABLE HEAD -->
      <thead class="sticky top-0 z-20 border-b border-white/15 bg-slate-950/95 backdrop-blur font-semibold text-white/70 tracking-wider uppercase text-[11px]">
        <tr>
          <!-- Kolom Judul -->
          <th
            scope="col"
            class="px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer min-w-[260px] max-w-sm"
            onclick={() => toggleSort('title')}
          >
            <div class="flex items-center gap-1.5">
              <span>Judul Catatan</span>
              {#if sortColumn === 'title'}
                {#if sortDirection === 'asc'}<ArrowUp class="size-3 text-indigo-400" />{:else}<ArrowDown class="size-3 text-indigo-400" />{/if}
              {:else}
                <ArrowUpDown class="size-3 opacity-30" />
              {/if}
            </div>
          </th>

          <!-- Kolom Status / List -->
          <th
            scope="col"
            class="px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer w-44"
            onclick={() => toggleSort('list')}
          >
            <div class="flex items-center gap-1.5">
              <span>Status / List</span>
              {#if sortColumn === 'list'}
                {#if sortDirection === 'asc'}<ArrowUp class="size-3 text-indigo-400" />{:else}<ArrowDown class="size-3 text-indigo-400" />{/if}
              {:else}
                <ArrowUpDown class="size-3 opacity-30" />
              {/if}
            </div>
          </th>

          <!-- Kolom Tagar & Label -->
          <th scope="col" class="px-4 py-3 min-w-[180px]">
            <span>Tagar &amp; Label</span>
          </th>

          <!-- Kolom Tenggat Waktu -->
          <th
            scope="col"
            class="px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer w-44"
            onclick={() => toggleSort('deadline')}
          >
            <div class="flex items-center gap-1.5">
              <span>Tenggat Waktu</span>
              {#if sortColumn === 'deadline'}
                {#if sortDirection === 'asc'}<ArrowUp class="size-3 text-indigo-400" />{:else}<ArrowDown class="size-3 text-indigo-400" />{/if}
              {:else}
                <ArrowUpDown class="size-3 opacity-30" />
              {/if}
            </div>
          </th>

          <!-- Kolom Diunggah / Dibuat -->
          <th
            scope="col"
            class="px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer w-36"
            onclick={() => toggleSort('created')}
          >
            <div class="flex items-center gap-1.5">
              <span>Diunggah</span>
              {#if sortColumn === 'created'}
                {#if sortDirection === 'asc'}<ArrowUp class="size-3 text-indigo-400" />{:else}<ArrowDown class="size-3 text-indigo-400" />{/if}
              {:else}
                <ArrowUpDown class="size-3 opacity-30" />
              {/if}
            </div>
          </th>

          <!-- Kolom Aksi -->
          <th scope="col" class="px-3 py-3 text-right w-24">
            <span>Aksi</span>
          </th>
        </tr>
      </thead>

      <!-- TABLE BODY -->
      <tbody class="divide-y divide-white/5 bg-slate-900/60 font-normal">
        {#if sortedCards.length === 0}
          <tr>
            <td colspan="6" class="py-16 text-center text-white/40">
              <div class="mx-auto flex max-w-xs flex-col items-center justify-center">
                <div class="rounded-2xl bg-white/5 p-3.5 mb-3 text-slate-500">
                  <Table2 class="size-7" />
                </div>
                <p class="font-medium text-white/70">Tidak ada catatan yang cocok</p>
                <p class="text-xs text-white/40 mt-1">
                  {#if searchQuery || selectedListId !== 'all' || store.activeTags.length > 0}
                    Coba sesuaikan kata kunci pencarian atau filter Anda.
                  {:else}
                    Papan ini belum memiliki catatan. Klik tombol di bawah untuk membuat catatan pertama.
                  {/if}
                </p>
                {#if !isAddingInline}
                  <button
                    type="button"
                    onclick={() => (isAddingInline = true)}
                    class="mt-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    + Tambah Catatan Sekarang
                  </button>
                {/if}
              </div>
            </td>
          </tr>
        {:else}
          {#each sortedCards as card (card.id)}
            {@const coverUrl = extractFirstImage(card.content)}
            {@const snippet = cleanSnippet(card.content)}
            {@const tags = extractTags(card.content)}
            {@const dlState = deadlineState(card.deadline_date)}
            {@const listStyle = getListBadgeStyle(card.list_id)}

            <tr class="group hover:bg-white/5 transition-colors">
              <!-- 1. Judul Catatan -->
              <td class="px-4 py-2.5">
                <div
                  role="button"
                  tabindex="0"
                  onclick={() => onopen(card.id)}
                  onkeydown={(e) => e.key === 'Enter' && onopen(card.id)}
                  class="flex items-center gap-3 cursor-pointer text-left"
                >
                  {#if coverUrl}
                    <div class="size-8 shrink-0 overflow-hidden rounded-lg bg-slate-800 border border-white/10">
                      <img src={coverUrl} alt={card.title} class="size-full object-cover" loading="lazy" />
                    </div>
                  {:else}
                    <div class="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 border border-white/10 text-indigo-400 group-hover:text-white transition-colors">
                      <StickyNote class="size-4" />
                    </div>
                  {/if}

                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-white group-hover:text-indigo-300 transition-colors truncate text-xs sm:text-[13px]">
                      {card.title}
                    </p>
                    {#if snippet}
                      <p class="truncate font-mono text-[11px] text-white/40 mt-0.5">
                        {snippet}
                      </p>
                    {/if}
                  </div>
                </div>
              </td>

              <!-- 2. Status / List (Interactive Dropdown Pill) -->
              <td class="px-4 py-2.5">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger
                    class="group/pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border shadow-2xs transition cursor-pointer bg-white/10 border-white/15 hover:bg-white/20 text-white"
                  >
                    <span class="size-2 rounded-full shrink-0" style="background-color: {listStyle.dot}"></span>
                    <span class="truncate max-w-[95px]">{getListTitle(card.list_id)}</span>
                    <ChevronDown class="size-3 text-white/40 group-hover/pill:text-white" />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content class="z-50 min-w-44 rounded-xl border border-slate-700 bg-slate-900 p-1 text-xs text-white shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100">
                      <div class="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        Ubah Status List
                      </div>
                      {#each store.sortedLists as l (l.id)}
                        {@const isCurrent = l.id === card.list_id}
                        {@const st = getListBadgeStyle(l.id)}
                        <DropdownMenu.Item
                          onSelect={() => handleMoveCard(card.id, l.id)}
                          class="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition cursor-pointer hover:bg-indigo-600 hover:text-white {isCurrent ? 'bg-white/10 font-semibold' : 'text-white/80'}"
                        >
                          <div class="flex items-center gap-2">
                            <span class="size-2 rounded-full" style="background-color: {st.dot}"></span>
                            <span>{l.title}</span>
                          </div>
                          {#if isCurrent}
                            <Check class="size-3 text-indigo-400" />
                          {/if}
                        </DropdownMenu.Item>
                      {/each}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </td>

              <!-- 3. Tagar & Label -->
              <td class="px-4 py-2.5">
                {#if tags.length > 0}
                  <div class="flex flex-wrap items-center gap-1">
                    {#each tags.slice(0, 3) as tag (tag)}
                      {@const style = getTagColor(tag)}
                      {@const isFiltered = store.activeTags.includes(tag)}
                      <button
                        type="button"
                        onclick={() => store.toggleTag(tag)}
                        class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium border transition cursor-pointer {isFiltered
                          ? 'bg-white text-slate-900 border-white ring-1 ring-white'
                          : `${style.bg} ${style.text} ${style.border} hover:opacity-80`}"
                        title={`Filter #${tag}`}
                      >
                        <span class="opacity-60">#</span>{tag}
                      </button>
                    {/each}
                    {#if tags.length > 3}
                      <span class="text-[10px] text-white/40 font-mono">+{tags.length - 3}</span>
                    {/if}
                  </div>
                {:else}
                  <span class="text-white/20 italic text-[11px]">-</span>
                {/if}
              </td>

              <!-- 4. Tenggat Waktu -->
              <td class="px-4 py-2.5">
                {#if card.deadline_date}
                  <span class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border {badgeDeadline[dlState]}">
                    <CalendarClock class="size-3 shrink-0" />
                    <span>{formatDateTime(card.deadline_date)}</span>
                  </span>
                {:else}
                  <span class="text-white/20 italic text-[11px]">-</span>
                {/if}
              </td>

              <!-- 5. Diunggah -->
              <td class="px-4 py-2.5 text-white/60 text-[11px]" title="Diunggah: {formatDateTime(card.uploaded_at)}">
                {formatDate(card.uploaded_at)}
              </td>

              <!-- 6. Aksi Cepat -->
              <td class="px-3 py-2.5 text-right">
                <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onclick={() => onopen(card.id)}
                    class="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition cursor-pointer"
                    title="Buka detail catatan"
                  >
                    <ExternalLink class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onclick={() => {
                      cardToDelete = card;
                      confirmDeleteOpen = true;
                    }}
                    class="rounded-lg p-1.5 text-red-400/70 hover:bg-red-500/20 hover:text-red-300 transition cursor-pointer"
                    title="Hapus catatan"
                  >
                    <Trash2 class="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <!-- 3. FOOTER STATISTIK DATABASE TABEL (NOTION STYLE) -->
  <footer class="flex items-center justify-between border-t border-white/10 bg-slate-950/90 px-4 py-2 text-[11px] text-white/50 shrink-0">
    <div class="flex items-center gap-4">
      <span>Total: <strong class="text-white">{stats.total}</strong> catatan</span>
      <span class="text-white/20">&bull;</span>
      <span>Dengan Deadline: <strong class="text-white">{stats.withDeadline}</strong></span>
      {#if stats.overdue > 0}
        <span class="text-white/20">&bull;</span>
        <span class="text-red-400 font-medium">Terlewat: <strong>{stats.overdue}</strong></span>
      {/if}
    </div>
    <div class="text-[10px] text-white/40 hidden sm:inline">
      Klik baris atau ikon untuk membuka detail catatan
    </div>
  </footer>
</div>

<!-- Modal Konfirmasi Hapus Kartu -->
<ConfirmDialog
  bind:open={confirmDeleteOpen}
  title="Hapus Catatan?"
  description={`Catatan "${cardToDelete?.title ?? ''}" akan disembunyikan dari papan.`}
  onconfirm={() => {
    if (cardToDelete) {
      store.updateCard(cardToDelete.id, { deleted_at: new Date().toISOString() });
      toast.show(`Catatan "${cardToDelete.title}" telah dihapus.`, 'info');
    }
  }}
/>
