<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { RealtimeChannel } from '@supabase/supabase-js';
  import { DropdownMenu } from 'bits-ui';
  import Plus from '@lucide/svelte/icons/plus';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import TopBar from '../components/TopBar.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import InlineEdit from '../components/InlineEdit.svelte';
  import { supabase } from '../lib/supabase';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import { byPosition, mergeRow } from '../lib/merge';
  import { positionBetween } from '../lib/fractional';
  import { formatDate } from '../lib/format';
  import type { Board } from '../lib/types';

  let boards = $state<Board[]>([]);
  let loading = $state(true);
  let newTitle = $state('');
  let toDelete = $state<Board | null>(null);
  let confirmOpen = $state(false);
  let channel: RealtimeChannel | null = null;

  const sorted = $derived([...boards].sort(byPosition));

  onMount(async () => {
    const { data, error } = await supabase().from('boards').select('*').is('deleted_at', null);
    if (error) toast.error(error.message);
    boards = data ?? [];
    loading = false;
    channel = supabase()
      .channel('boards:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, (p) => {
        const row = p.new as Board;
        if (row?.id) boards = mergeRow(boards, row);
      })
      .subscribe();
  });
  onDestroy(() => channel?.unsubscribe());

  async function create(e: SubmitEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const board: Board = {
      id: crypto.randomUUID(),
      title,
      position: positionBetween(sorted.at(-1)?.position, null),
      created_by: auth.user?.id ?? null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    boards = [...boards, board];
    newTitle = '';
    const { error } = await supabase()
      .from('boards')
      .insert({ id: board.id, title, position: board.position, created_by: board.created_by });
    if (error) {
      boards = boards.filter((b) => b.id !== board.id);
      toast.error(`Gagal membuat papan: ${error.message}`);
    }
  }

  async function update(id: string, patch: Partial<Pick<Board, 'title' | 'deleted_at'>>) {
    const before = boards.find((b) => b.id === id);
    boards = patch.deleted_at
      ? boards.filter((b) => b.id !== id)
      : boards.map((b) => (b.id === id ? { ...b, ...patch, updated_at: new Date().toISOString() } : b));
    const { error } = await supabase().from('boards').update(patch).eq('id', id);
    if (error && before) {
      boards = [...boards.filter((b) => b.id !== id), before];
      toast.error(error.message);
    }
  }
</script>

<div class="flex h-full flex-col">
  <TopBar />
  <main class="mx-auto w-full max-w-6xl flex-1 overflow-y-auto p-6">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Papan</h1>
        <p class="text-sm text-slate-500">Semua papan tim. Perubahan tersinkron secara realtime.</p>
      </div>
      <form onsubmit={create} class="flex w-full gap-2 sm:w-auto">
        <input class="input sm:w-64" placeholder="Nama papan baru…" bind:value={newTitle} maxlength="120" />
        <button class="btn-primary shrink-0" type="submit" disabled={!newTitle.trim()}>
          <Plus class="size-4" /> Buat
        </button>
      </form>
    </div>

    {#if loading}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each Array(3) as _, i (i)}
          <div class="h-28 animate-pulse rounded-2xl bg-slate-200"></div>
        {/each}
      </div>
    {:else if sorted.length === 0}
      <div class="rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-500">
        <LayoutDashboard class="mx-auto mb-3 size-8 text-slate-400" />
        Belum ada papan. Buat papan pertama di atas.
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each sorted as board (board.id)}
          <div
            class="group relative flex h-28 flex-col justify-between rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white shadow-sm transition hover:shadow-lg"
          >
            <div class="flex items-start gap-2">
              <InlineEdit
                value={board.title}
                class="min-w-0 flex-1 text-lg font-semibold"
                inputClass="text-slate-900"
                onsave={(title) => update(board.id, { title })}
              />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger class="rounded-md p-1 text-white/70 hover:bg-white/15 hover:text-white">
                  <Ellipsis class="size-4" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content class="menu-content" align="end" sideOffset={4}>
                    <DropdownMenu.Item
                      class="menu-item text-red-600"
                      onSelect={() => {
                        toDelete = board;
                        confirmOpen = true;
                      }}
                    >
                      <Trash2 class="size-4" /> Hapus papan
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-white/70">Dibuat {formatDate(board.created_at)}</span>
              <button class="btn bg-white/15 text-white hover:bg-white/25" onclick={() => router.go(`/board/${board.id}`)}>
                Buka
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus papan?"
  description={`Papan "${toDelete?.title ?? ''}" akan disembunyikan dari semua anggota tim. Data tetap tersimpan di database internal.`}
  onconfirm={() => toDelete && update(toDelete.id, { deleted_at: new Date().toISOString() })}
/>
