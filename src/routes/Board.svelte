<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Plus from '@lucide/svelte/icons/plus';
  import FileDown from '@lucide/svelte/icons/file-down';
  import Wifi from '@lucide/svelte/icons/wifi';
  import WifiOff from '@lucide/svelte/icons/wifi-off';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import TopBar from '../components/TopBar.svelte';
  import ListColumn from '../components/ListColumn.svelte';
  import CardDialog from '../components/CardDialog.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import { BoardStore } from '../lib/board.svelte';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { List } from '../lib/types';

  let { boardId, cardId }: { boardId: string; cardId?: string } = $props();

  // svelte-ignore state_referenced_locally — komponen di-key per boardId di App.svelte
  const store = new BoardStore(boardId);
  let newList = $state('');
  let exporting = $state(false);
  let listToDelete = $state<List | null>(null);
  let confirmOpen = $state(false);

  const openCard = $derived(cardId ? store.findCard(cardId) : undefined);

  onMount(() => store.load());
  onDestroy(() => store.destroy());

  const openCardById = (id: string) => router.go(`/board/${boardId}/card/${id}`);
  const closeCard = () => router.go(`/board/${boardId}`);

  async function addList(e: SubmitEvent) {
    e.preventDefault();
    const title = newList.trim();
    if (!title) return;
    newList = '';
    await store.addList(title);
  }

  async function exportDocx() {
    if (!store.board) return;
    exporting = true;
    try {
      // Lazy-load: library docx hanya diunduh saat tombol ekspor diklik
      const { exportBoardDocx } = await import('../lib/export-docx');
      await exportBoardDocx(store.board, store.lists, store.cards);
      toast.success('Dokumen Word berhasil dibuat.');
    } catch (err) {
      toast.error(`Gagal ekspor: ${(err as Error).message}`);
    } finally {
      exporting = false;
    }
  }
</script>

<div class="flex h-full flex-col bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900">
  <TopBar title={store.board?.title ?? ''}>
    <span
      class="hidden items-center gap-1 rounded-full px-2 py-0.5 text-xs sm:inline-flex {store.connected
        ? 'bg-emerald-500/20 text-emerald-300'
        : 'bg-white/10 text-white/60'}"
      title={store.connected ? 'Tersambung realtime' : 'Menyambungkan…'}
    >
      {#if store.connected}<Wifi class="size-3" /> Live{:else}<WifiOff class="size-3" /> Offline{/if}
    </span>
    <button
      class="btn bg-white/10 text-white hover:bg-white/20"
      onclick={exportDocx}
      disabled={exporting || !store.board}
    >
      {#if exporting}<LoaderCircle class="size-4 animate-spin" />{:else}<FileDown class="size-4" />{/if}
      <span class="hidden sm:inline">Ekspor Word</span>
    </button>
  </TopBar>

  {#if store.loading}
    <div class="grid flex-1 place-items-center text-white/70">
      <LoaderCircle class="size-6 animate-spin" />
    </div>
  {:else if store.error}
    <div class="grid flex-1 place-items-center p-6 text-center text-white">
      <div>
        <p class="font-medium">{store.error}</p>
        <button class="btn mt-4 bg-white/15 text-white hover:bg-white/25" onclick={() => router.go('/')}>
          <ChevronLeft class="size-4" /> Kembali ke daftar papan
        </button>
      </div>
    </div>
  {:else}
    <main class="flex flex-1 items-start gap-3 overflow-x-auto p-4">
      {#each store.sortedLists as list, i (list.id)}
        <ListColumn
          {list}
          {store}
          isFirst={i === 0}
          isLast={i === store.sortedLists.length - 1}
          onopen={openCardById}
          ondelete={(l) => {
            listToDelete = l;
            confirmOpen = true;
          }}
        />
      {/each}

      <form onsubmit={addList} class="w-72 shrink-0 rounded-2xl bg-white/15 p-2 backdrop-blur">
        <input
          class="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-white/70 focus:border-white/40 focus:bg-white/10 focus:outline-none"
          placeholder="+ Tambah list baru"
          bind:value={newList}
          maxlength="120"
        />
        {#if newList.trim()}
          <button class="btn-primary mt-2" type="submit"><Plus class="size-4" /> Tambah list</button>
        {/if}
      </form>
    </main>
  {/if}
</div>

{#if openCard}
  <CardDialog card={openCard} {store} onclose={closeCard} />
{/if}

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus list?"
  description={`List "${listToDelete?.title ?? ''}" beserta kartunya akan disembunyikan dari papan.`}
  onconfirm={() => listToDelete && store.updateList(listToDelete.id, { deleted_at: new Date().toISOString() })}
/>
