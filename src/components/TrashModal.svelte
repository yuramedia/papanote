<script lang="ts">
  import { Dialog } from 'bits-ui';
  import X from '@lucide/svelte/icons/x';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Search from '@lucide/svelte/icons/search';
  import FileText from '@lucide/svelte/icons/file-text';
  import Kanban from '@lucide/svelte/icons/kanban';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import StickyNote from '@lucide/svelte/icons/sticky-note';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Check from '@lucide/svelte/icons/check';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import {
    fetchBoardTrash,
    restoreCardDb,
    restoreListDb,
    permanentDeleteCardDb,
    permanentDeleteListDb,
    emptyBoardTrashDb,
    restoreAllBoardTrashDb,
    resolveRestoreListId,
    formatDeletedRelativeTime,
    filterTrashCards,
    filterTrashLists,
    type TrashCardItem,
    type TrashListItem,
  } from '../lib/trash';
  import { cleanSnippet, extractFirstImage } from '../lib/attachments';
  import { toast } from '../lib/toast.svelte';
  import type { List } from '../lib/types';

  let {
    open = $bindable(false),
    boardId,
    activeLists = [],
    onrestore,
  }: {
    open?: boolean;
    boardId: string;
    activeLists?: List[];
    onrestore?: () => void;
  } = $props();

  let activeTab = $state<'cards' | 'lists'>('cards');
  let searchQuery = $state('');
  let loading = $state(false);
  let actionLoading = $state(false);
  let cards = $state<TrashCardItem[]>([]);
  let lists = $state<TrashListItem[]>([]);

  // Dialog Konfirmasi Hapus Permanen Tunggal
  let itemToDelete = $state<{ type: 'card' | 'list'; id: string; title: string } | null>(null);
  let confirmDeleteOpen = $state(false);

  // Dialog Konfirmasi Kosongkan Sampah
  let confirmEmptyOpen = $state(false);

  // Dialog Konfirmasi Pulihkan Semua
  let confirmRestoreAllOpen = $state(false);

  // Muat data saat modal dibuka
  $effect(() => {
    if (open && boardId) {
      loadTrashData();
    }
  });

  async function loadTrashData() {
    loading = true;
    try {
      const summary = await fetchBoardTrash(boardId);
      cards = summary.cards;
      lists = summary.lists;
    } catch (err) {
      toast.error('Gagal memuat kotak sampah: ' + (err as Error).message);
    } finally {
      loading = false;
    }
  }

  const displayedCards = $derived(filterTrashCards(cards, searchQuery));
  const displayedLists = $derived(filterTrashLists(lists, searchQuery));
  const totalTrashCount = $derived(cards.length + lists.length);

  async function handleRestoreCard(card: TrashCardItem) {
    const targetListId = resolveRestoreListId(card, activeLists);
    if (!targetListId) {
      toast.show('Buat list di papan terlebih dahulu sebelum memulihkan catatan ini.', 'info');
      return;
    }

    actionLoading = true;
    try {
      const success = await restoreCardDb(card.id, targetListId);
      if (success) {
        cards = cards.filter((c) => c.id !== card.id);
        const targetListTitle = activeLists.find((l) => l.id === targetListId)?.title ?? 'Papan';
        toast.success(`Catatan "${card.title}" berhasil dipulihkan ke list "${targetListTitle}".`);
        onrestore?.();
      } else {
        toast.error('Gagal memulihkan catatan.');
      }
    } catch (err) {
      toast.error('Gagal memulihkan catatan: ' + (err as Error).message);
    } finally {
      actionLoading = false;
    }
  }

  async function handleRestoreList(list: TrashListItem) {
    actionLoading = true;
    try {
      const success = await restoreListDb(list.id, true);
      if (success) {
        lists = lists.filter((l) => l.id !== list.id);
        // Hapus juga kartu-kartu milik list ini dari kotak sampah karena ikut terpulihkan
        cards = cards.filter((c) => c.list_id !== list.id);
        toast.success(`List "${list.title}" beserta catatannya berhasil dipulihkan.`);
        onrestore?.();
      } else {
        toast.error('Gagal memulihkan list.');
      }
    } catch (err) {
      toast.error('Gagal memulihkan list: ' + (err as Error).message);
    } finally {
      actionLoading = false;
    }
  }

  async function executePermanentDelete() {
    if (!itemToDelete) return;
    actionLoading = true;
    try {
      if (itemToDelete.type === 'card') {
        const success = await permanentDeleteCardDb(itemToDelete.id);
        if (success) {
          cards = cards.filter((c) => c.id !== itemToDelete!.id);
          toast.show(`Catatan "${itemToDelete.title}" telah dihapus secara permanen.`, 'info');
        }
      } else {
        const success = await permanentDeleteListDb(itemToDelete.id);
        if (success) {
          lists = lists.filter((l) => l.id !== itemToDelete!.id);
          cards = cards.filter((c) => c.list_id !== itemToDelete!.id);
          toast.show(`List "${itemToDelete.title}" telah dihapus secara permanen.`, 'info');
        }
      }
    } catch (err) {
      toast.error('Gagal menghapus item: ' + (err as Error).message);
    } finally {
      actionLoading = false;
      itemToDelete = null;
    }
  }

  async function executeEmptyTrash() {
    actionLoading = true;
    try {
      const success = await emptyBoardTrashDb(boardId);
      if (success) {
        cards = [];
        lists = [];
        toast.success('Kotak sampah berhasil dikosongkan secara permanen.');
      }
    } catch (err) {
      toast.error('Gagal mengosongkan sampah: ' + (err as Error).message);
    } finally {
      actionLoading = false;
    }
  }

  async function executeRestoreAll() {
    actionLoading = true;
    try {
      const success = await restoreAllBoardTrashDb(boardId);
      if (success) {
        cards = [];
        lists = [];
        toast.success('Semua catatan dan list berhasil dipulihkan ke papan!');
        onrestore?.();
      }
    } catch (err) {
      toast.error('Gagal memulihkan semua item: ' + (err as Error).message);
    } finally {
      actionLoading = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 flex h-[85vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-slate-900 border border-white/10 text-white shadow-2xl overflow-hidden"
    >
      <!-- 1. HEADER MODAL -->
      <div class="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-slate-950/60">
        <div class="flex items-center gap-3">
          <div class="grid size-9 place-items-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Trash2 class="size-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-semibold text-base text-white">Kotak Sampah Papan</h2>
              <span class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70 font-mono">
                {totalTrashCount} item
              </span>
            </div>
            <p class="text-xs text-white/50 mt-0.5">
              Catatan dan list yang dihapus dapat dipulihkan kembali atau dibersihkan secara permanen.
            </p>
          </div>
        </div>

        <Dialog.Close
          class="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition cursor-pointer"
          aria-label="Tutup"
        >
          <X class="size-5" />
        </Dialog.Close>
      </div>

      <!-- 2. TOOLBAR SUBHEADER: Tabs, Search & Batch Actions -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/90 px-5 py-2.5 text-xs">
        <!-- Tab Switcher -->
        <div class="flex items-center rounded-xl bg-white/10 p-1">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium transition cursor-pointer {activeTab === 'cards'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-white/70 hover:text-white'}"
            onclick={() => (activeTab = 'cards')}
          >
            <FileText class="size-3.5" />
            <span>Catatan</span>
            <span class="ml-1 rounded-full px-1.5 py-0.2 text-[10px] {activeTab === 'cards' ? 'bg-white/20' : 'bg-black/20'}">
              {cards.length}
            </span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium transition cursor-pointer {activeTab === 'lists'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-white/70 hover:text-white'}"
            onclick={() => (activeTab = 'lists')}
          >
            <Kanban class="size-3.5" />
            <span>List / Kolom</span>
            <span class="ml-1 rounded-full px-1.5 py-0.2 text-[10px] {activeTab === 'lists' ? 'bg-white/20' : 'bg-black/20'}">
              {lists.length}
            </span>
          </button>
        </div>

        <!-- Search Input -->
        <div class="relative flex-1 max-w-xs min-w-[160px]">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/40 pointer-events-none" />
          <input
            type="text"
            placeholder={activeTab === 'cards' ? 'Cari catatan di sampah...' : 'Cari list di sampah...'}
            bind:value={searchQuery}
            class="w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-7 py-1 text-xs text-white placeholder-white/40 focus:border-indigo-400 focus:outline-none"
          />
          {#if searchQuery}
            <button
              type="button"
              onclick={() => (searchQuery = '')}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
            >
              <X class="size-3" />
            </button>
          {/if}
        </div>

        <!-- Batch Actions -->
        {#if totalTrashCount > 0}
          <div class="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onclick={() => (confirmRestoreAllOpen = true)}
              disabled={actionLoading}
              class="flex items-center gap-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 font-medium transition cursor-pointer disabled:opacity-50"
              title="Pulihkan semua catatan dan list ke papan"
            >
              <RotateCcw class="size-3.5" />
              <span class="hidden sm:inline">Pulihkan Semua</span>
            </button>
            <button
              type="button"
              onclick={() => (confirmEmptyOpen = true)}
              disabled={actionLoading}
              class="flex items-center gap-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 px-2.5 py-1 font-medium transition cursor-pointer disabled:opacity-50"
              title="Hapus seluruh isi kotak sampah secara permanen"
            >
              <Trash2 class="size-3.5" />
              <span class="hidden sm:inline">Kosongkan Sampah</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- 3. BODY LIST OF TRASH ITEMS -->
      <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {#if loading}
          <div class="flex h-full flex-col items-center justify-center text-white/50 py-16">
            <LoaderCircle class="size-7 animate-spin text-indigo-400 mb-2" />
            <p class="text-xs">Memeriksa isi kotak sampah…</p>
          </div>
        {:else if activeTab === 'cards'}
          <!-- TAB CATATAN -->
          {#if displayedCards.length === 0}
            <div class="flex h-full flex-col items-center justify-center text-center py-16 text-white/40">
              <div class="rounded-2xl bg-white/5 p-4 mb-3 border border-white/5 text-slate-500">
                <Trash2 class="size-8" />
              </div>
              <p class="font-medium text-white/70">
                {searchQuery ? 'Tidak ada catatan yang cocok dengan pencarian' : 'Kotak sampah catatan kosong'}
              </p>
              <p class="text-xs text-white/40 mt-1 max-w-sm">
                {searchQuery ? 'Coba ubah kata kunci pencarian Anda.' : 'Catatan yang dihapus dari papan akan tersimpan aman di sini sebelum dihapus permanen.'}
              </p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each displayedCards as card (card.id)}
                {@const coverUrl = extractFirstImage(card.content)}
                {@const snippet = cleanSnippet(card.content)}

                <div class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3 hover:bg-white/5 transition-colors group">
                  <!-- Kiri: Thumbnail & Ringkasan Catatan -->
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    {#if coverUrl}
                      <div class="size-10 shrink-0 overflow-hidden rounded-lg bg-slate-800 border border-white/10">
                        <img src={coverUrl} alt={card.title} class="size-full object-cover" />
                      </div>
                    {:else}
                      <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-white/5 border border-white/10 text-indigo-400">
                        <StickyNote class="size-5" />
                      </div>
                    {/if}

                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <h4 class="font-medium text-sm text-white truncate max-w-md">{card.title}</h4>
                      </div>

                      {#if snippet}
                        <p class="text-xs text-white/50 truncate font-mono mt-0.5" title={snippet}>
                          {snippet}
                        </p>
                      {/if}

                      <div class="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                        <!-- List Asal -->
                        <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 {card.isListDeleted ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/10 text-white/70'}">
                          <Kanban class="size-3" />
                          <span>List: {card.listTitle}</span>
                          {#if card.isListDeleted}
                            <span class="text-[10px] font-semibold text-amber-400">(List terhapus)</span>
                          {/if}
                        </span>

                        <!-- Waktu Dihapus -->
                        <span class="text-white/40">
                          🕒 Dihapus {formatDeletedRelativeTime(card.deleted_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Kanan: Aksi Pulihkan & Hapus Permanen -->
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onclick={() => handleRestoreCard(card)}
                      disabled={actionLoading}
                      class="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                      title="Pulihkan catatan ini ke papan"
                    >
                      <RotateCcw class="size-3.5" />
                      <span>Pulihkan</span>
                    </button>

                    <button
                      type="button"
                      onclick={() => (itemToDelete = { type: 'card', id: card.id, title: card.title })}
                      disabled={actionLoading}
                      class="rounded-lg p-2 text-rose-400/70 hover:bg-rose-500/20 hover:text-rose-300 transition cursor-pointer"
                      title="Hapus permanen dari database"
                    >
                      <Trash2 class="size-4" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- TAB LIST / KOLOM -->
          {#if displayedLists.length === 0}
            <div class="flex h-full flex-col items-center justify-center text-center py-16 text-white/40">
              <div class="rounded-2xl bg-white/5 p-4 mb-3 border border-white/5 text-slate-500">
                <Kanban class="size-8" />
              </div>
              <p class="font-medium text-white/70">
                {searchQuery ? 'Tidak ada list yang cocok dengan pencarian' : 'Tidak ada list di kotak sampah'}
              </p>
              <p class="text-xs text-white/40 mt-1 max-w-sm">
                List yang dihapus beserta seluruh kartunya dapat dipulihkan kapan saja di tab ini.
              </p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each displayedLists as list (list.id)}
                <div class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3 hover:bg-white/5 transition-colors group">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      <Kanban class="size-5" />
                    </div>
                    <div>
                      <h4 class="font-medium text-sm text-white truncate max-w-md">{list.title}</h4>
                      <div class="flex items-center gap-2 mt-1 text-[11px] text-white/50">
                        <span class="rounded bg-white/10 px-1.5 py-0.5 text-white/70">
                          {list.cardCount} catatan terkait
                        </span>
                        <span>•</span>
                        <span>🕒 Dihapus {formatDeletedRelativeTime(list.deleted_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onclick={() => handleRestoreList(list)}
                      disabled={actionLoading}
                      class="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                      title="Pulihkan list beserta kartunya ke papan"
                    >
                      <RotateCcw class="size-3.5" />
                      <span>Pulihkan List</span>
                    </button>

                    <button
                      type="button"
                      onclick={() => (itemToDelete = { type: 'list', id: list.id, title: list.title })}
                      disabled={actionLoading}
                      class="rounded-lg p-2 text-rose-400/70 hover:bg-rose-500/20 hover:text-rose-300 transition cursor-pointer"
                      title="Hapus list permanen dari database"
                    >
                      <Trash2 class="size-4" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- 4. FOOTER MODAL -->
      <div class="flex items-center justify-between border-t border-white/10 bg-slate-950/80 px-5 py-3 text-xs text-white/50">
        <div class="flex items-center gap-2">
          <Sparkles class="size-3.5 text-indigo-400" />
          <span>Item yang dipulihkan akan langsung muncul di Kanban, Dokumen, dan Kalender secara realtime.</span>
        </div>
        <Dialog.Close class="btn bg-white/10 hover:bg-white/20 text-white text-xs py-1.5 px-4 rounded-lg cursor-pointer">
          Tutup
        </Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<!-- Dialog Konfirmasi Hapus Permanen Tunggal -->
<ConfirmDialog
  bind:open={confirmDeleteOpen}
  title={`Hapus Permanen ${itemToDelete?.type === 'card' ? 'Catatan' : 'List'}?`}
  description={`"${itemToDelete?.title ?? ''}" akan dihapus permanen dari server dan tidak dapat dipulihkan lagi.`}
  onconfirm={executePermanentDelete}
/>

<!-- Dialog Konfirmasi Kosongkan Kotak Sampah -->
<ConfirmDialog
  bind:open={confirmEmptyOpen}
  title="Kosongkan Seluruh Kotak Sampah?"
  description="Semua catatan dan list yang ada di kotak sampah papan ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan."
  onconfirm={executeEmptyTrash}
/>

<!-- Dialog Konfirmasi Pulihkan Semua -->
<ConfirmDialog
  bind:open={confirmRestoreAllOpen}
  title="Pulihkan Semua Item?"
  description="Semua catatan dan list yang ada di kotak sampah akan dikembalikan ke posisi aktif di papan ini."
  onconfirm={executeRestoreAll}
/>
