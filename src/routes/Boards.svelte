<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { RealtimeChannel } from '@supabase/supabase-js';
  import { DropdownMenu } from 'bits-ui';
  import Plus from '@lucide/svelte/icons/plus';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import Globe from '@lucide/svelte/icons/globe';
  import Lock from '@lucide/svelte/icons/lock';
  import Users from '@lucide/svelte/icons/users';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import TopBar from '../components/TopBar.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import InlineEdit from '../components/InlineEdit.svelte';
  import BoardVisibilityDialog from '../components/BoardVisibilityDialog.svelte';
  import { supabase } from '../lib/supabase';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import { byPosition, mergeRow } from '../lib/merge';
  import { positionBetween } from '../lib/fractional';
  import { formatDate } from '../lib/format';
  import { canAccessBoard, canManageBoardVisibility, getUserBoardRole } from '../lib/board-access';
  import type { Board, BoardVisibility } from '../lib/types';

  let boards = $state<Board[]>([]);
  let loading = $state(true);
  let newTitle = $state('');
  let newVisibility = $state<BoardVisibility>('public');
  let toDelete = $state<Board | null>(null);
  let confirmOpen = $state(false);
  let visibilityBoard = $state<Board | null>(null);
  let visibilityOpen = $state(false);
  let filterTab = $state<'all' | 'mine' | 'shared'>('all');
  let channel: RealtimeChannel | null = null;

  const sorted = $derived([...boards].sort(byPosition));

  // Hanya tampilkan papan yang diizinkan untuk user saat ini (kecuali Admin yang bisa lihat semua)
  const accessibleBoards = $derived(
    sorted.filter((b) => canAccessBoard(b, auth.user, auth.isAdmin))
  );

  const displayedBoards = $derived.by(() => {
    if (filterTab === 'mine') {
      return accessibleBoards.filter((b) => b.created_by === auth.user?.id);
    }
    if (filterTab === 'shared') {
      return accessibleBoards.filter((b) => b.created_by !== auth.user?.id);
    }
    return accessibleBoards;
  });

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
    const currentUserId = auth.user?.id ?? null;
    const board: Board = {
      id: crypto.randomUUID(),
      title,
      position: positionBetween(sorted.at(-1)?.position, null),
      visibility: newVisibility,
      member_ids: newVisibility === 'members' && currentUserId ? [currentUserId] : [],
      member_roles: {},
      created_by: currentUserId,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    boards = [...boards, board];
    newTitle = '';
    const { error } = await supabase()
      .from('boards')
      .insert({
        id: board.id,
        title,
        position: board.position,
        visibility: board.visibility,
        member_ids: board.member_ids,
        member_roles: board.member_roles,
        created_by: board.created_by,
      });
    if (error) {
      boards = boards.filter((b) => b.id !== board.id);
      toast.error(`Gagal membuat papan: ${error.message}`);
    } else {
      toast.success(`Papan "${title}" berhasil dibuat.`);
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

  async function updateVisibility(
    boardId: string,
    patch: { visibility: BoardVisibility; member_ids: string[]; member_roles: Record<string, 'admin' | 'user'> }
  ) {
    const before = boards.find((b) => b.id === boardId);
    boards = boards.map((b) =>
      b.id === boardId ? { ...b, ...patch, updated_at: new Date().toISOString() } : b
    );
    const { error } = await supabase().from('boards').update(patch).eq('id', boardId);
    if (error) {
      if (before) boards = boards.map((b) => (b.id === boardId ? before : b));
      throw new Error(error.message);
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
      <form onsubmit={create} class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <input class="input sm:w-64" placeholder="Nama papan baru…" bind:value={newTitle} maxlength="120" />
        <select
          bind:value={newVisibility}
          class="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none cursor-pointer"
          title="Pilih visibilitas awal papan"
        >
          <option value="public">🌐 Semua Tim</option>
          <option value="private">🔒 Pribadi</option>
          <option value="members">👥 Anggota Pilihan</option>
        </select>
        <button class="btn-primary shrink-0" type="submit" disabled={!newTitle.trim()}>
          <Plus class="size-4" /> Buat
        </button>
      </form>
    </div>

    <!-- Filter Tab Papan (Semua / Papan Saya / Dibagikan) -->
    {#if accessibleBoards.length > 0}
      <div class="mb-5 flex items-center gap-1.5 border-b border-slate-200 pb-2 text-xs">
        <button
          type="button"
          class="rounded-lg px-3 py-1 font-medium transition cursor-pointer {filterTab === 'all'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100'}"
          onclick={() => (filterTab = 'all')}
        >
          Semua ({accessibleBoards.length})
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1 font-medium transition cursor-pointer {filterTab === 'mine'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100'}"
          onclick={() => (filterTab = 'mine')}
        >
          Papan Saya ({accessibleBoards.filter((b) => b.created_by === auth.user?.id).length})
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1 font-medium transition cursor-pointer {filterTab === 'shared'
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100'}"
          onclick={() => (filterTab = 'shared')}
        >
          Dibagikan ({accessibleBoards.filter((b) => b.created_by !== auth.user?.id).length})
        </button>
      </div>
    {/if}

    {#if loading}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each Array(3) as _, i (i)}
          <div class="h-28 animate-pulse rounded-2xl bg-slate-200"></div>
        {/each}
      </div>
    {:else if displayedBoards.length === 0}
      <div class="rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-500">
        <LayoutDashboard class="mx-auto mb-3 size-8 text-slate-400" />
        {#if accessibleBoards.length === 0}
          Belum ada papan yang dapat diakses. Buat papan pertama di atas.
        {:else}
          Tidak ada papan di kategori "{filterTab === 'mine' ? 'Papan Saya' : 'Dibagikan'}".
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each displayedBoards as board (board.id)}
          {@const myRole = getUserBoardRole(board, auth.user, auth.isAdmin)}
          <div
            class="group relative flex h-28 flex-col justify-between rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white shadow-sm transition hover:shadow-lg"
          >
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 truncate">
                  <InlineEdit
                    value={board.title}
                    class="min-w-0 font-semibold text-lg truncate"
                    inputClass="text-slate-900"
                    onsave={(title) => update(board.id, { title })}
                  />
                  <span
                    class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[10px] font-semibold shrink-0 {myRole === 'owner'
                      ? 'bg-purple-400/30 text-purple-100 ring-1 ring-purple-300/30'
                      : myRole === 'admin'
                        ? 'bg-amber-400/30 text-amber-100 ring-1 ring-amber-300/30'
                        : 'bg-white/15 text-white/80'}"
                    title={`Peran Anda di papan ini: ${myRole}`}
                  >
                    {#if myRole === 'owner'}
                      👑 Owner
                    {:else if myRole === 'admin'}
                      🛡️ Admin
                    {:else}
                      👤 User
                    {/if}
                  </span>
                </div>
              </div>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger class="rounded-md p-1 text-white/70 hover:bg-white/15 hover:text-white cursor-pointer">
                  <Ellipsis class="size-4" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content class="menu-content min-w-48" align="end" sideOffset={4}>
                    <!-- Opsi Atur Akses & Visibilitas -->
                    <DropdownMenu.Item
                      class="menu-item text-xs"
                      onSelect={() => {
                        visibilityBoard = board;
                        visibilityOpen = true;
                      }}
                    >
                      <ShieldCheck class="size-4 text-indigo-500" />
                      <span>Akses &amp; Visibilitas</span>
                    </DropdownMenu.Item>

                    <DropdownMenu.Separator class="my-1 h-px bg-slate-100" />

                    <!-- Opsi Hapus Papan -->
                    <DropdownMenu.Item
                      class="menu-item text-xs text-red-600"
                      onSelect={() => {
                        toDelete = board;
                        confirmOpen = true;
                      }}
                    >
                      <Trash2 class="size-4" />
                      <span>Hapus papan</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            <!-- Footer Kartu: Badge Visibilitas & Tombol Buka -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer {board.visibility === 'private'
                    ? 'bg-amber-400/25 text-amber-200 hover:bg-amber-400/35'
                    : board.visibility === 'members'
                      ? 'bg-indigo-400/25 text-indigo-200 hover:bg-indigo-400/35'
                      : 'bg-emerald-400/25 text-emerald-200 hover:bg-emerald-400/35'}"
                  onclick={() => {
                    visibilityBoard = board;
                    visibilityOpen = true;
                  }}
                  title="Klik untuk melihat / mengubah hak akses"
                >
                  {#if board.visibility === 'private'}
                    <Lock class="size-2.5" />
                    <span>Pribadi</span>
                  {:else if board.visibility === 'members'}
                    <Users class="size-2.5" />
                    <span>{board.member_ids?.length || 1} Anggota</span>
                  {:else}
                    <Globe class="size-2.5" />
                    <span>Semua Tim</span>
                  {/if}
                </button>
                <span class="text-[11px] text-white/60 truncate">&bull; {formatDate(board.created_at)}</span>
              </div>

              <button class="btn bg-white/15 text-white hover:bg-white/25 text-xs py-1 px-3" onclick={() => router.go(`/board/${board.id}`)}>
                Buka
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<BoardVisibilityDialog
  bind:open={visibilityOpen}
  board={visibilityBoard}
  onsave={updateVisibility}
/>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus papan?"
  description={`Papan "${toDelete?.title ?? ''}" akan disembunyikan dari semua anggota tim. Data tetap tersimpan di database internal.`}
  onconfirm={() => toDelete && update(toDelete.id, { deleted_at: new Date().toISOString() })}
/>
