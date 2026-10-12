<script lang="ts">
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import GitCompare from '@lucide/svelte/icons/git-compare';
  import Eye from '@lucide/svelte/icons/eye';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import Search from '@lucide/svelte/icons/search';
  import X from '@lucide/svelte/icons/x';
  import History from '@lucide/svelte/icons/history';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import { supabase } from '../lib/supabase';
  import { formatDateTime, relativeTime } from '../lib/format';
  import { computeLineDiff } from '../lib/diff';
  import { renderMarkdown } from '../lib/markdown';
  import { toast } from '../lib/toast.svelte';
  import type { CardHistory } from '../lib/types';

  let {
    cardId,
    currentContent = '',
    refreshKey,
    onrestore,
  }: {
    cardId: string;
    currentContent?: string;
    refreshKey: string;
    onrestore: (content: string) => void;
  } = $props();

  let items = $state<CardHistory[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Status interaksi
  let selectedHistoryId = $state<string | null>(null);
  let viewMode = $state<'diff' | 'preview'>('diff');
  let searchQuery = $state('');
  let confirmRestoreId = $state<string | null>(null);
  let copiedId = $state<string | null>(null);

  async function load(id: string) {
    loading = true;
    const { data, error: err } = await supabase()
      .from('card_histories')
      .select('*')
      .eq('card_id', id)
      .order('created_at', { ascending: false })
      .limit(60);

    error = err?.message ?? null;
    items = data ?? [];
    loading = false;

    // Default pilih item pertama jika ada
    if (items.length > 0 && !selectedHistoryId) {
      selectedHistoryId = items[0].id;
    }
  }

  // Muat ulang saat kartu berganti atau kontennya berubah
  $effect(() => {
    void refreshKey;
    load(cardId);
  });

  const filteredItems = $derived.by<CardHistory[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((h) => (h.old_content ?? '').toLowerCase().includes(q));
  });

  const selectedHistory = $derived.by<CardHistory | undefined>(() => {
    return items.find((h) => h.id === selectedHistoryId);
  });

  // Hitung perbedaan antara versi lama terpilih dengan konten saat ini
  const diffData = $derived.by(() => {
    if (!selectedHistory) return null;
    const oldText = selectedHistory.old_content ?? '';
    return computeLineDiff(oldText, currentContent);
  });

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = id;
      toast.success('Teks versi lama disalin ke clipboard!');
      setTimeout(() => {
        if (copiedId === id) copiedId = null;
      }, 2000);
    } catch {
      toast.error('Gagal menyalin teks.');
    }
  }

  function handleRestoreClick(h: CardHistory) {
    confirmRestoreId = h.id;
  }

  function confirmRestore(h: CardHistory) {
    onrestore(h.old_content ?? '');
    confirmRestoreId = null;
  }
</script>

<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
  <!-- Header Time Machine -->
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
    <div class="flex items-center gap-2">
      <div class="grid size-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
        <History class="size-4" />
      </div>
      <div>
        <h4 class="text-sm font-semibold text-slate-900">Riwayat Perubahan (Time Machine)</h4>
        <p class="text-[11px] text-slate-500">
          Versi lama tersimpan otomatis setiap kali Anda atau tim mengedit catatan.
        </p>
      </div>
    </div>

    <!-- Kotak Cari Riwayat -->
    {#if items.length > 1}
      <div class="relative w-full sm:w-48">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Cari dalam riwayat..."
          class="w-full rounded-lg border border-slate-200 bg-slate-50 py-1 pl-7 pr-6 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
        />
        {#if searchQuery}
          <button
            type="button"
            onclick={() => (searchQuery = '')}
            class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X class="size-3" />
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
      <LoaderCircle class="size-4 animate-spin text-indigo-600" />
      <span>Memuat linimasa riwayat versi…</span>
    </div>
  {:else if error}
    <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
      Gagal memuat riwayat: {error}
    </div>
  {:else if items.length === 0}
    <div class="py-8 text-center text-xs text-slate-400 italic">
      Belum ada riwayat perubahan tercatat untuk kartu ini. Riwayat akan otomatis tercatat saat catatan diedit kembali.
    </div>
  {:else}
    <!-- Konten Utama: Linimasa Versi & Panel Perbandingan Diff -->
    <div class="grid grid-cols-1 md:grid-cols-[13rem_1fr] gap-4 min-h-[300px]">
      <!-- 1. Daftar Linimasa Versi (Kiri) -->
      <div class="border-b md:border-b-0 md:border-r border-slate-100 pr-0 md:pr-3 space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
          Linimasa Versi ({filteredItems.length})
        </div>

        {#each filteredItems as h, idx (h.id)}
          {@const isSelected = selectedHistoryId === h.id}
          <button
            type="button"
            onclick={() => {
              selectedHistoryId = h.id;
              confirmRestoreId = null;
            }}
            class="group flex w-full items-start gap-2 rounded-xl p-2 text-left transition cursor-pointer {isSelected
              ? 'bg-indigo-50/80 border border-indigo-200 shadow-2xs'
              : 'hover:bg-slate-50 border border-transparent'}"
          >
            <!-- Node titik linimasa -->
            <div class="mt-1 flex flex-col items-center">
              <span
                class="size-2.5 rounded-full border-2 transition {isSelected
                  ? 'border-indigo-600 bg-indigo-600'
                  : 'border-slate-300 bg-white group-hover:border-slate-400'}"
              ></span>
              {#if idx < filteredItems.length - 1}
                <span class="w-0.5 h-6 bg-slate-200 my-0.5"></span>
              {/if}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-1">
                <span class="text-xs font-semibold {isSelected ? 'text-indigo-900' : 'text-slate-700'}">
                  {relativeTime(h.created_at)}
                </span>
                {#if idx === 0}
                  <span class="rounded bg-indigo-100 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700">
                    Terbaru
                  </span>
                {/if}
              </div>
              <span class="text-[10px] text-slate-400 block truncate" title={formatDateTime(h.created_at)}>
                {formatDateTime(h.created_at)}
              </span>
            </div>
          </button>
        {/each}
      </div>

      <!-- 2. Panel Detail Perbandingan (Kanan) -->
      {#if selectedHistory}
        <div class="flex flex-col min-w-0 space-y-3">
          <!-- Toolbar Atas Panel Detail -->
          <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div class="flex items-center gap-2">
              <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
                <button
                  type="button"
                  onclick={() => (viewMode = 'diff')}
                  class="flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition cursor-pointer {viewMode ===
                  'diff'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'}"
                >
                  <GitCompare class="size-3" />
                  <span>Perbandingan Diff</span>
                </button>
                <button
                  type="button"
                  onclick={() => (viewMode = 'preview')}
                  class="flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition cursor-pointer {viewMode ===
                  'preview'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'}"
                >
                  <Eye class="size-3" />
                  <span>Pratinjau Versi</span>
                </button>
              </div>

              <!-- Statistik Perbedaan baris -->
              {#if viewMode === 'diff' && diffData}
                <div class="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
                  <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 font-semibold">
                    +{diffData.additions}
                  </span>
                  <span class="rounded bg-red-100 px-1.5 py-0.5 text-red-800 font-semibold">
                    -{diffData.deletions}
                  </span>
                </div>
              {/if}
            </div>

            <!-- Tombol Aksi: Salin & Pulihkan -->
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onclick={() => copyText(selectedHistory.old_content ?? '', selectedHistory.id)}
                class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                title="Salin teks versi lama ke clipboard"
              >
                {#if copiedId === selectedHistory.id}
                  <Check class="size-3 text-emerald-600" />
                  <span class="text-emerald-700">Tersalin</span>
                {:else}
                  <Copy class="size-3 text-slate-500" />
                  <span class="hidden sm:inline">Salin</span>
                {/if}
              </button>

              <button
                type="button"
                onclick={() => handleRestoreClick(selectedHistory)}
                class="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                title="Kembalikan isi catatan ke versi ini"
              >
                <RotateCcw class="size-3" />
                <span>Pulihkan Versi Ini</span>
              </button>
            </div>
          </div>

          <!-- Konfirmasi Pulihkan -->
          {#if confirmRestoreId === selectedHistory.id}
            <div
              class="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 animate-in fade-in-0 duration-150"
            >
              <div class="flex items-center gap-2">
                <AlertTriangle class="size-4 shrink-0 text-amber-600" />
                <span>Yakin pulihkan? Konten saat ini akan diganti dengan versi dari <strong>{relativeTime(selectedHistory.created_at)}</strong>.</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onclick={() => confirmRestore(selectedHistory)}
                  class="rounded-lg bg-amber-600 hover:bg-amber-700 px-2.5 py-1 font-semibold text-white transition cursor-pointer"
                >
                  Ya, Pulihkan
                </button>
                <button
                  type="button"
                  onclick={() => (confirmRestoreId = null)}
                  class="rounded-lg border border-amber-300 bg-white px-2 py-1 text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          {/if}

          <!-- Konten: 1. Diff View / 2. Markdown Preview -->
          {#if viewMode === 'diff' && diffData}
            <div class="flex-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-900 font-mono text-xs shadow-inner custom-scrollbar">
              <div class="bg-slate-950/80 px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-800 flex justify-between">
                <span>Versi Lama ({relativeTime(selectedHistory.created_at)}) &rarr; Saat Ini</span>
                <span>Hijau (+) / Merah (-)</span>
              </div>

              {#if diffData.lines.length === 0}
                <div class="p-4 text-center text-slate-500 italic">Tidak ada teks.</div>
              {:else}
                <div class="divide-y divide-slate-800/50">
                  {#each diffData.lines as line}
                    {#if line.type === 'added'}
                      <div class="flex bg-emerald-950/40 text-emerald-300 px-3 py-1 hover:bg-emerald-950/60 transition-colors">
                        <span class="w-6 shrink-0 select-none font-bold text-emerald-500">+</span>
                        <span class="w-8 shrink-0 select-none text-slate-600 text-[10px]">{line.newLineNumber || ''}</span>
                        <span class="break-words whitespace-pre-wrap flex-1">{line.text || ' '}</span>
                      </div>
                    {:else if line.type === 'removed'}
                      <div class="flex bg-red-950/40 text-red-300 px-3 py-1 hover:bg-red-950/60 transition-colors">
                        <span class="w-6 shrink-0 select-none font-bold text-red-500">-</span>
                        <span class="w-8 shrink-0 select-none text-slate-600 text-[10px]">{line.oldLineNumber || ''}</span>
                        <span class="break-words whitespace-pre-wrap flex-1 line-through opacity-80">{line.text || ' '}</span>
                      </div>
                    {:else}
                      <div class="flex text-slate-300 px-3 py-1 hover:bg-slate-800/40 transition-colors">
                        <span class="w-6 shrink-0 select-none text-slate-600"> </span>
                        <span class="w-8 shrink-0 select-none text-slate-600 text-[10px]">{line.newLineNumber || line.oldLineNumber || ''}</span>
                        <span class="break-words whitespace-pre-wrap flex-1 opacity-90">{line.text || ' '}</span>
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <!-- 2. Full Markdown Preview -->
            <div class="flex-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner custom-scrollbar">
              <div class="markdown-body text-xs text-slate-800 leading-relaxed">
                {@html renderMarkdown(selectedHistory.old_content ?? '')}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
