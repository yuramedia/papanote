<script lang="ts">
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { supabase } from '../lib/supabase';
  import { formatDateTime, relativeTime } from '../lib/format';
  import type { CardHistory } from '../lib/types';

  let {
    cardId,
    refreshKey,
    onrestore,
  }: { cardId: string; refreshKey: string; onrestore: (content: string) => void } = $props();

  let items = $state<CardHistory[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load(id: string) {
    loading = true;
    const { data, error: err } = await supabase()
      .from('card_histories')
      .select('*')
      .eq('card_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    error = err?.message ?? null;
    items = data ?? [];
    loading = false;
  }

  // Muat ulang saat kartu berganti atau kontennya berubah (versi baru tercipta).
  $effect(() => {
    void refreshKey;
    load(cardId);
  });
</script>

<div class="space-y-2">
  <p class="text-xs text-slate-500">Versi lama disimpan otomatis setiap konten berubah dan dihapus setelah 30 hari.</p>
  {#if loading}
    <div class="flex items-center gap-2 py-4 text-sm text-slate-500">
      <LoaderCircle class="size-4 animate-spin" /> Memuat riwayat…
    </div>
  {:else if error}
    <p class="text-sm text-red-600">{error}</p>
  {:else if items.length === 0}
    <p class="py-4 text-center text-sm text-slate-400">Belum ada riwayat perubahan.</p>
  {:else}
    <ul class="max-h-72 space-y-2 overflow-y-auto pr-1">
      {#each items as h (h.id)}
        <li class="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-500" title={formatDateTime(h.created_at)}>{relativeTime(h.created_at)}</span>
            <button class="btn-ghost px-2 py-0.5 text-xs" onclick={() => onrestore(h.old_content ?? '')}>
              <RotateCcw class="size-3" /> Pulihkan
            </button>
          </div>
          <p class="mt-1 line-clamp-4 text-xs break-words whitespace-pre-line text-slate-700">
            {h.old_content || '(kosong)'}
          </p>
        </li>
      {/each}
    </ul>
  {/if}
</div>
