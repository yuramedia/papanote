<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from './lib/auth.svelte';
  import { router } from './lib/router.svelte';
  import { isConfigured, loadConfig, supabase } from './lib/supabase';
  import { registerServiceWorker } from './lib/push';
  import Login from './routes/Login.svelte';
  import Boards from './routes/Boards.svelte';
  import BoardView from './routes/Board.svelte';
  import Toaster from './components/Toaster.svelte';

  let status = $state<'loading' | 'ready' | 'unconfigured' | 'error'>('loading');
  let errorMessage = $state('');

  onMount(async () => {
    try {
      const config = await loadConfig();
      if (!isConfigured(config)) {
        status = 'unconfigured';
        return;
      }
      await auth.init();
      registerServiceWorker();
      status = 'ready';
    } catch (err) {
      errorMessage = (err as Error).message;
      status = 'error';
    }
  });

  // Gerbang akses: tanpa sesi → login; sudah login → jangan tampilkan login.
  $effect(() => {
    if (status !== 'ready') return;
    const name = router.route.name;
    if (!auth.session && name !== 'login') router.go('/login', true);
    else if (auth.session && name === 'login') router.go('/', true);
  });

  // Tautan dari notifikasi push: #/card/:id → cari papannya lalu buka kartu.
  $effect(() => {
    const r = router.route;
    if (status !== 'ready' || !auth.session || r.name !== 'card') return;
    (async () => {
      const { data } = await supabase()
        .from('cards')
        .select('id, lists!inner(board_id)')
        .eq('id', r.cardId)
        .maybeSingle();
      const boardId = (data?.lists as unknown as { board_id: string } | null)?.board_id;
      router.go(boardId ? `/board/${boardId}/card/${r.cardId}` : '/', true);
    })();
  });
</script>

{#if status === 'loading'}
  <div class="grid h-full place-items-center text-slate-500">
    <div class="flex items-center gap-3">
      <span class="size-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></span>
      Memuat…
    </div>
  </div>
{:else if status === 'unconfigured'}
  <div class="grid h-full place-items-center p-6">
    <div class="max-w-md rounded-2xl bg-white p-6 shadow">
      <h1 class="text-lg font-semibold">Konfigurasi belum lengkap</h1>
      <p class="mt-2 text-sm text-slate-600">
        Server belum memiliki <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code>. Isi variabel tersebut di
        <code>.env</code> lalu jalankan ulang server.
      </p>
    </div>
  </div>
{:else if status === 'error'}
  <div class="grid h-full place-items-center p-6 text-center">
    <div>
      <p class="font-medium text-red-600">Gagal memuat aplikasi</p>
      <p class="mt-1 text-sm text-slate-500">{errorMessage}</p>
      <button class="btn-primary mt-4" onclick={() => location.reload()}>Coba lagi</button>
    </div>
  </div>
{:else if router.route.name === 'login' || !auth.session}
  <Login />
{:else if router.route.name === 'board'}
  {#key router.route.boardId}
    <BoardView boardId={router.route.boardId} cardId={router.route.cardId} />
  {/key}
{:else if router.route.name === 'boards'}
  <Boards />
{/if}

<Toaster />
