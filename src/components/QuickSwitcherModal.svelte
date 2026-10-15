<script lang="ts">
  import { Dialog } from 'bits-ui';
  import Search from '@lucide/svelte/icons/search';
  import Terminal from '@lucide/svelte/icons/terminal';
  import StickyNote from '@lucide/svelte/icons/sticky-note';
  import CornerDownLeft from '@lucide/svelte/icons/corner-down-left';
  import X from '@lucide/svelte/icons/x';
  import Kanban from '@lucide/svelte/icons/kanban';
  import FileText from '@lucide/svelte/icons/file-text';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import Network from '@lucide/svelte/icons/network';
  import Layers from '@lucide/svelte/icons/layers';
  import Plus from '@lucide/svelte/icons/plus';
  import FileDown from '@lucide/svelte/icons/file-down';
  import Users from '@lucide/svelte/icons/users';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Home from '@lucide/svelte/icons/home';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Table2 from '@lucide/svelte/icons/table-2';
  import LayoutTemplate from '@lucide/svelte/icons/layout-template';
  import Timer from '@lucide/svelte/icons/timer';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { router } from '../lib/router.svelte';
  import type { BoardStore } from '../lib/board.svelte';
  import { searchCards, type SearchCardResult } from '../lib/omnisearch';
  import { filterCommands, type PaletteCommand } from '../lib/commands';
  import { getTagColor } from '../lib/tags';
  import { pomodoro } from '../lib/pomodoro.svelte';

  let {
    open = $bindable(false),
    store,
    initialMode = 'search',
    onselect,
    onSwitchView,
    onNewCard,
    onNewList,
    onExportDocx,
    onOpenVisibility,
    onCreateFromTemplate,
    onOpenTemplates,
    onOpenTrash,
  }: {
    open?: boolean;
    store: BoardStore;
    initialMode?: 'search' | 'command';
    onselect: (cardId: string) => void;
    onSwitchView?: (view: 'kanban' | 'notes' | 'calendar' | 'graph' | 'canvas' | 'table') => void;
    onNewCard?: () => void;
    onNewList?: () => void;
    onExportDocx?: () => void;
    onOpenVisibility?: () => void;
    onCreateFromTemplate?: (templateId: string) => void;
    onOpenTemplates?: () => void;
    onOpenTrash?: () => void;
  } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  // Deteksi mode: otomatis berpindah ke command mode jika diawali '>'
  const isCommandMode = $derived(query.trim().startsWith('>'));

  // Daftar perintah papan
  const allCommands = $derived.by<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [
      {
        id: 'view-notes',
        title: 'Buka Tampilan Notes (Obsidian View)',
        description: 'Beralih ke editor dokumen ala Obsidian dengan hierarki folder',
        category: 'Tampilan',
        shortcut: 'Notes',
        keywords: ['notes', 'dokumen', 'obsidian', 'editor', 'tulis'],
        iconName: 'notes',
        action: () => {
          onSwitchView?.('notes');
        },
      },
      {
        id: 'view-kanban',
        title: 'Buka Tampilan Kanban Board',
        description: 'Tampilan kolom dan kartu seret-lepas (drag-and-drop)',
        category: 'Tampilan',
        shortcut: 'Kanban',
        keywords: ['kanban', 'board', 'papan', 'kolom'],
        iconName: 'kanban',
        action: () => {
          onSwitchView?.('kanban');
        },
      },
      {
        id: 'view-calendar',
        title: 'Buka Tampilan Kalender & Timeline',
        description: 'Tampilan agenda bulanan & mingguan berdasarkan tenggat waktu',
        category: 'Tampilan',
        shortcut: 'Calendar',
        keywords: ['kalender', 'calendar', 'timeline', 'jadwal', 'deadline'],
        iconName: 'calendar',
        action: () => {
          onSwitchView?.('calendar');
        },
      },
      {
        id: 'view-graph',
        title: 'Buka Tampilan Interactive Graph View',
        description: 'Graf visualisasi jejaring relasi antar catatan ala Obsidian',
        category: 'Tampilan',
        shortcut: 'Graph',
        keywords: ['graph', 'graf', 'network', 'jaringan', 'relasi', 'node'],
        iconName: 'graph',
        action: () => {
          onSwitchView?.('graph');
        },
      },
      {
        id: 'view-canvas',
        title: 'Buka Tampilan Infinite Canvas',
        description: 'Kanvas tanpa batas untuk papan tulis dan pemetaan ide visual',
        category: 'Tampilan',
        shortcut: 'Canvas',
        keywords: ['canvas', 'kanvas', 'whiteboard', 'mindmap'],
        iconName: 'canvas',
        action: () => {
          onSwitchView?.('canvas');
        },
      },
      {
        id: 'view-table',
        title: 'Buka Tampilan Database Tabel (Notion Grid View)',
        description: 'Tampilan tabel database terstruktur dengan filter list, tagar, dan sorting',
        category: 'Tampilan',
        shortcut: 'Table',
        keywords: ['table', 'tabel', 'grid', 'database', 'notion', 'airtable', 'baris', 'kolom'],
        iconName: 'table',
        action: () => {
          onSwitchView?.('table');
        },
      },
      {
        id: 'action-new-card',
        title: 'Buat Catatan Baru (+ Note)',
        description: 'Tambahkan catatan baru ke list pertama di papan',
        category: 'Aksi',
        shortcut: '+ Note',
        keywords: ['buat', 'tambah', 'catatan', 'kartu', 'new', 'add'],
        iconName: 'plus',
        action: () => {
          onNewCard?.();
        },
      },
      {
        id: 'action-open-templates',
        title: 'Buka Koleksi Template Catatan (Template Library)',
        description: 'Pilih, pratinjau, atau buat template kustom baru',
        category: 'Template',
        shortcut: 'Templates',
        keywords: ['template', 'pilih template', 'koleksi template', 'kustom', 'library'],
        iconName: 'template',
        action: () => {
          onOpenTemplates?.();
        },
      },
      {
        id: 'template-meeting',
        title: 'Buat Catatan: Notula Rapat (Meeting Notes)',
        description: 'Template notula rapat lengkap dengan agenda, peserta, dan action items',
        category: 'Template',
        keywords: ['meeting', 'rapat', 'notula', 'agenda', 'action item'],
        iconName: 'template',
        action: () => {
          onCreateFromTemplate?.('meeting-notes');
        },
      },
      {
        id: 'template-bug',
        title: 'Buat Catatan: Laporan Bug (Bug Report)',
        description: 'Template pelaporan bug dengan langkah reproduksi dan lingkungan',
        category: 'Template',
        keywords: ['bug', 'error', 'issue', 'laporan bug', 'defect'],
        iconName: 'template',
        action: () => {
          onCreateFromTemplate?.('bug-report');
        },
      },
      {
        id: 'template-project',
        title: 'Buat Catatan: Rencana Proyek (Project Kickoff)',
        description: 'Template perencanaan proyek dengan target milestone dan mitigasi risiko',
        category: 'Template',
        keywords: ['project', 'kickoff', 'proyek', 'rencana', 'milestone', 'planning'],
        iconName: 'template',
        action: () => {
          onCreateFromTemplate?.('project-kickoff');
        },
      },
      {
        id: 'template-standup',
        title: 'Buat Catatan: Daily Standup & Jurnal Kerja',
        description: 'Template jurnal harian: kemarin, hari ini, dan hambatan tim',
        category: 'Template',
        keywords: ['standup', 'daily', 'harian', 'jurnal', 'yesterday', 'today'],
        iconName: 'template',
        action: () => {
          onCreateFromTemplate?.('daily-standup');
        },
      },
      {
        id: 'template-spec',
        title: 'Buat Catatan: Spesifikasi Fitur (PRD / Feature Spec)',
        description: 'Dokumen spesifikasi produk, user problem, dan kriteria keberhasilan',
        category: 'Template',
        keywords: ['spec', 'prd', 'fitur', 'feature', 'spesifikasi', 'desain'],
        iconName: 'template',
        action: () => {
          onCreateFromTemplate?.('feature-spec');
        },
      },
      {
        id: 'pomodoro-start',
        title: 'Mulai Timer Fokus Pomodoro (25 Menit)',
        description: 'Mulai sesi kerja fokus intensif dengan timer 25 menit',
        category: 'Fokus',
        shortcut: 'Pomodoro',
        keywords: ['pomodoro', 'fokus', 'focus', 'timer', 'kerja', 'waktu'],
        iconName: 'timer',
        action: () => {
          pomodoro.switchMode('focus');
          pomodoro.start();
        },
      },
      {
        id: 'pomodoro-toggle',
        title: 'Jeda / Lanjutkan Timer Pomodoro',
        description: 'Ubah status timer pomodoro yang sedang berjalan',
        category: 'Fokus',
        keywords: ['jeda', 'pause', 'play', 'lanjutkan', 'pomodoro', 'timer'],
        iconName: 'timer',
        action: () => {
          pomodoro.toggle();
        },
      },
      {
        id: 'pomodoro-short-break',
        title: 'Mulai Istirahat Singkat Pomodoro (5 Menit)',
        description: 'Ambil jeda istirahat pendek sejenak untuk menyegarkan pikiran',
        category: 'Fokus',
        keywords: ['istirahat', 'break', 'rehat', 'kopi', '5 menit', 'short break'],
        iconName: 'timer',
        action: () => {
          pomodoro.switchMode('short_break');
          pomodoro.start();
        },
      },
      {
        id: 'pomodoro-long-break',
        title: 'Mulai Istirahat Panjang Pomodoro (15 Menit)',
        description: 'Ambil jeda istirahat panjang setelah menyelesaikan beberapa siklus fokus',
        category: 'Fokus',
        keywords: ['istirahat panjang', 'long break', 'santai', '15 menit'],
        iconName: 'timer',
        action: () => {
          pomodoro.switchMode('long_break');
          pomodoro.start();
        },
      },
      {
        id: 'pomodoro-reset',
        title: 'Reset Timer Pomodoro',
        description: 'Kembalikan timer ke durasi awal dan hentikan hitungan mundur',
        category: 'Fokus',
        keywords: ['reset', 'ulang', 'stop', 'hentikan', 'pomodoro'],
        iconName: 'timer',
        action: () => {
          pomodoro.reset();
        },
      },
      {
        id: 'action-new-list',
        title: 'Buat List Kolom Baru',
        description: 'Tambahkan kolom list baru ke papan Kanban',
        category: 'Aksi',
        shortcut: '+ List',
        keywords: ['list', 'kolom', 'tambah list', 'buat list'],
        iconName: 'list-plus',
        action: () => {
          onNewList?.();
        },
      },
      {
        id: 'action-export-docx',
        title: 'Ekspor Papan ke Dokumen Word (.docx)',
        description: 'Unduh seluruh catatan papan dalam format berkas Microsoft Word',
        category: 'Aksi',
        shortcut: 'Word',
        keywords: ['ekspor', 'export', 'word', 'docx', 'unduh', 'download'],
        iconName: 'export',
        action: () => {
          onExportDocx?.();
        },
      },
      {
        id: 'filter-reset',
        title: 'Reset Semua Filter Tagar',
        description: `Hapus saringan aktif (${store.activeTags.length} tag terpilih)`,
        category: 'Filter',
        keywords: ['reset', 'filter', 'clear', 'tag', 'hapus filter'],
        iconName: 'filter-x',
        action: () => {
          store.clearTags();
        },
      },
      {
        id: 'board-visibility',
        title: 'Kelola Visibilitas & Hak Akses Papan',
        description: 'Atur izin akses papan (Publik, Pribadi, atau Anggota Tertentu)',
        category: 'Papan',
        keywords: ['akses', 'visibilitas', 'anggota', 'member', 'izin', 'permission'],
        iconName: 'users',
        action: () => {
          onOpenVisibility?.();
        },
      },
      {
        id: 'action-open-trash',
        title: 'Buka Kotak Sampah Papan (Recycle Bin)',
        description: 'Lihat, pulihkan, atau bersihkan catatan dan list yang telah dihapus',
        category: 'Aksi',
        shortcut: 'Sampah',
        keywords: ['sampah', 'trash', 'recycle', 'pulihkan', 'restore', 'hapus', 'bin'],
        iconName: 'trash',
        action: () => {
          onOpenTrash?.();
        },
      },
      {
        id: 'nav-home',
        title: 'Kembali ke Daftar Papan (Beranda)',
        description: 'Navigasi kembali ke dashboard utama seluruh papan',
        category: 'Papan',
        keywords: ['beranda', 'home', 'kembali', 'daftar papan'],
        iconName: 'home',
        action: () => {
          router.go('/');
        },
      },
    ];
    return list;
  });

  // Hasil perintah terfilter
  const filteredCommands = $derived.by<PaletteCommand[]>(() => {
    if (!isCommandMode) return [];
    return filterCommands(allCommands, query);
  });

  // Hasil pencarian kartu terfilter (Omnisearch deep-search)
  const searchResults = $derived.by<SearchCardResult[]>(() => {
    if (isCommandMode) return [];
    return searchCards(store.cards, query, store.lists);
  });

  // Total item saat ini
  const totalItems = $derived(isCommandMode ? filteredCommands.length : searchResults.length);

  $effect(() => {
    if (open) {
      query = initialMode === 'command' ? '> ' : '';
      selectedIndex = 0;
      setTimeout(() => inputEl?.focus(), 60);
    }
  });

  $effect(() => {
    if (selectedIndex >= totalItems) {
      selectedIndex = Math.max(0, totalItems - 1);
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      // Beralih antara mode pencarian dan perintah
      if (isCommandMode) {
        query = '';
      } else {
        query = '> ';
      }
      return;
    }

    if (totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % totalItems;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + totalItems) % totalItems;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isCommandMode) {
        const cmd = filteredCommands[selectedIndex];
        if (cmd) executeCommand(cmd);
      } else {
        const res = searchResults[selectedIndex];
        if (res) selectCard(res.card.id);
      }
    }
  }

  function selectCard(cardId: string) {
    open = false;
    onselect(cardId);
  }

  function executeCommand(cmd: PaletteCommand) {
    open = false;
    cmd.action();
  }

  function switchToMode(mode: 'search' | 'command') {
    if (mode === 'command') {
      query = '> ';
    } else {
      query = '';
    }
    inputEl?.focus();
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-150" />
    <Dialog.Content
      class="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl border border-slate-700/80 bg-slate-900 p-0 text-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- Mode Switcher Pills -->
      <div class="flex items-center justify-between border-b border-white/10 bg-slate-950/70 px-4 py-2 text-xs">
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer {!isCommandMode
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-white/60 hover:text-white'}"
            onclick={() => switchToMode('search')}
          >
            <Search class="size-3.5" />
            <span>Pencarian Catatan</span>
            <kbd class="font-mono text-[10px] bg-black/20 px-1 py-0.2 rounded opacity-75">Ctrl+O</kbd>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer {isCommandMode
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-white/60 hover:text-white'}"
            onclick={() => switchToMode('command')}
          >
            <Terminal class="size-3.5" />
            <span>Command Palette</span>
            <kbd class="font-mono text-[10px] bg-black/20 px-1 py-0.2 rounded opacity-75">Ctrl+P</kbd>
          </button>
        </div>
        <span class="text-[11px] text-white/40 hidden sm:inline">Tekan <kbd class="font-mono bg-white/10 px-1 rounded">Tab</kbd> untuk ganti</span>
      </div>

      <!-- Input Bar -->
      <div class="relative flex items-center border-b border-white/10 px-4 py-3.5">
        {#if isCommandMode}
          <Terminal class="size-5 text-indigo-400 shrink-0" />
        {:else}
          <Search class="size-5 text-indigo-400 shrink-0" />
        {/if}

        <input
          type="text"
          bind:this={inputEl}
          bind:value={query}
          onkeydown={handleKeyDown}
          placeholder={isCommandMode
            ? 'Ketik perintah... (contoh: > kanban, > ekspor, > buat)'
            : 'Cari catatan... (judul, isi teks markdown, atau #tag)'}
          class="w-full bg-transparent px-3 text-sm text-white placeholder-white/40 focus:outline-none"
        />

        {#if query}
          <button
            type="button"
            onclick={() => (query = isCommandMode ? '> ' : '')}
            class="text-white/40 hover:text-white transition-colors cursor-pointer mr-2"
            title="Bersihkan input"
          >
            <X class="size-4" />
          </button>
        {/if}
        <span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50 font-mono">ESC</span>
      </div>

      <!-- Container Hasil -->
      <div class="max-h-[22rem] overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {#if isCommandMode}
          <!-- DAFTAR PERINTAH (COMMAND PALETTE) -->
          {#if filteredCommands.length === 0}
            <div class="py-10 text-center text-xs text-white/40">
              Tidak ada perintah yang cocok dengan "{query.replace(/^>\s*/, '')}".
            </div>
          {:else}
            {#each filteredCommands as cmd, idx (cmd.id)}
              {@const isSelected = selectedIndex === idx}
              <button
                type="button"
                onclick={() => executeCommand(cmd)}
                onmouseenter={() => (selectedIndex = idx)}
                class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors cursor-pointer {isSelected
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-white/80 hover:bg-white/5'}"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="size-8 rounded-lg flex items-center justify-center shrink-0 {isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-500/20 text-indigo-300'}"
                  >
                    {#if cmd.iconName === 'notes'}
                      <FileText class="size-4" />
                    {:else if cmd.iconName === 'kanban'}
                      <Kanban class="size-4" />
                    {:else if cmd.iconName === 'calendar'}
                      <CalendarIcon class="size-4" />
                    {:else if cmd.iconName === 'graph'}
                      <Network class="size-4" />
                    {:else if cmd.iconName === 'canvas'}
                      <Layers class="size-4" />
                    {:else if cmd.iconName === 'table'}
                      <Table2 class="size-4" />
                    {:else if cmd.iconName === 'template'}
                      <LayoutTemplate class="size-4" />
                    {:else if cmd.iconName === 'timer'}
                      <Timer class="size-4" />
                    {:else if cmd.iconName === 'plus' || cmd.iconName === 'list-plus'}
                      <Plus class="size-4" />
                    {:else if cmd.iconName === 'export'}
                      <FileDown class="size-4" />
                    {:else if cmd.iconName === 'filter-x'}
                      <RotateCcw class="size-4" />
                    {:else if cmd.iconName === 'users'}
                      <Users class="size-4" />
                    {:else if cmd.iconName === 'trash'}
                      <Trash2 class="size-4" />
                    {:else}
                      <Home class="size-4" />
                    {/if}
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-sm truncate">{cmd.title}</p>
                    {#if cmd.description}
                      <p class="text-[11px] truncate mt-0.5 {isSelected ? 'text-indigo-100' : 'text-slate-400'}">
                        {cmd.description}
                      </p>
                    {/if}
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="rounded px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider {isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-white/10 text-white/60'}"
                  >
                    {cmd.category}
                  </span>
                  {#if isSelected}
                    <CornerDownLeft class="size-3.5 text-white/90" />
                  {/if}
                </div>
              </button>
            {/each}
          {/if}
        {:else}
          <!-- HASIL PENCARIAN CATATAN (OMNISEARCH) -->
          {#if searchResults.length === 0}
            <div class="py-10 text-center text-xs text-white/40">
              Tidak ada catatan yang cocok dengan "{query}".
            </div>
          {:else}
            {#each searchResults as res, idx (res.card.id)}
              {@const isSelected = selectedIndex === idx}
              <button
                type="button"
                onclick={() => selectCard(res.card.id)}
                onmouseenter={() => (selectedIndex = idx)}
                class="group flex w-full flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left text-xs transition-colors cursor-pointer {isSelected
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-white/80 hover:bg-white/5'}"
              >
                <!-- Baris Judul & List -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 truncate">
                    <StickyNote class="size-4 shrink-0 {isSelected ? 'text-white' : 'text-indigo-400'}" />
                    <span class="font-semibold text-sm truncate">
                      {#each res.titleSegments as seg}
                        {#if seg.isMatch}
                          <mark class="bg-amber-400 text-slate-900 rounded-xs px-0.5 font-bold">{seg.text}</mark>
                        {:else}
                          {seg.text}
                        {/if}
                      {/each}
                    </span>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <span
                      class="rounded px-2 py-0.5 text-[10px] font-medium {isSelected
                        ? 'bg-black/20 text-white'
                        : 'bg-white/10 text-white/70'}"
                    >
                      {res.listTitle}
                    </span>
                    {#if isSelected}
                      <CornerDownLeft class="size-3 text-white/80" />
                    {/if}
                  </div>
                </div>

                <!-- Cuplikan Teks yang Cocok (Matching Snippet) -->
                {#if res.snippetSegments}
                  <p
                    class="line-clamp-2 text-xs font-mono break-words {isSelected
                      ? 'text-indigo-100'
                      : 'text-slate-400'}"
                  >
                    {#each res.snippetSegments as seg}
                      {#if seg.isMatch}
                        <mark class="bg-amber-400 text-slate-900 rounded-xs px-0.5 font-bold">{seg.text}</mark>
                      {:else}
                        {seg.text}
                      {/if}
                    {/each}
                  </p>
                {/if}

                <!-- Tagar & Meta -->
                {#if res.tags.length > 0}
                  <div class="flex flex-wrap items-center gap-1 pt-0.5">
                    {#each res.tags.slice(0, 4) as t (t)}
                      {@const style = getTagColor(t)}
                      <span
                        class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[10px] font-medium border {isSelected
                          ? 'bg-white/20 text-white border-white/30'
                          : `${style.bg} ${style.text} ${style.border}`}"
                      >
                        <span class="opacity-60">#</span>{t}
                      </span>
                    {/each}
                    {#if res.tags.length > 4}
                      <span class="text-[10px] opacity-75">+{res.tags.length - 4}</span>
                    {/if}
                  </div>
                {/if}
              </button>
            {/each}
          {/if}
        {/if}
      </div>

      <!-- Footer Modal -->
      <div class="flex items-center justify-between border-t border-white/10 bg-slate-950/80 px-4 py-2 text-[11px] text-white/40">
        <div class="flex items-center gap-3">
          <span><kbd class="font-mono bg-white/10 px-1 rounded">↑</kbd> <kbd class="font-mono bg-white/10 px-1 rounded">↓</kbd> Navigasi</span>
          <span><kbd class="font-mono bg-white/10 px-1 rounded">↵</kbd> {isCommandMode ? 'Jalankan' : 'Buka'}</span>
          <span><kbd class="font-mono bg-white/10 px-1 rounded">Tab</kbd> Ganti Mode</span>
        </div>
        <span class="flex items-center gap-1">
          <Sparkles class="size-3 text-indigo-400" />
          <span>Omnisearch &amp; Palette</span>
        </span>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
