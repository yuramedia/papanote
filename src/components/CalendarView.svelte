<script lang="ts">
  import { onMount } from 'svelte';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Clock from '@lucide/svelte/icons/clock';
  import Plus from '@lucide/svelte/icons/plus';
  import Filter from '@lucide/svelte/icons/filter';
  import X from '@lucide/svelte/icons/x';
  import Inbox from '@lucide/svelte/icons/inbox';
  import AlertCircle from '@lucide/svelte/icons/alert-circle';
  import PanelRightClose from '@lucide/svelte/icons/panel-right-close';
  import PanelRightOpen from '@lucide/svelte/icons/panel-right-open';
  import Check from '@lucide/svelte/icons/check';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';
  import {
    getMonthDays,
    getWeekDays,
    toDateKey,
    updateDateKeepingTime,
    MONTH_NAMES_ID,
    DAY_NAMES_ID,
    SHORT_DAY_NAMES_ID,
  } from '../lib/calendar';
  import { deadlineState, formatDate } from '../lib/format';
  import { toast } from '../lib/toast.svelte';

  let { store, onopen }: { store: BoardStore; onopen: (id: string) => void } = $props();

  let currentDate = $state(new Date());
  let viewType = $state<'month' | 'week'>('month');
  let selectedListId = $state<string | 'all'>('all');
  let showUnscheduledDrawer = $state(false);
  let unscheduledSearch = $state('');
  let draggedCardId = $state<string | null>(null);
  let dragOverDateKey = $state<string | null>(null);

  // Palet warna untuk list
  const LIST_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#f97316', // Orange
    '#14b8a6', // Teal
  ];

  function getListColor(listId: string): string {
    const idx = store.lists.findIndex((l) => l.id === listId);
    if (idx === -1) return '#64748b';
    return LIST_COLORS[idx % LIST_COLORS.length];
  }

  function getListTitle(listId: string): string {
    return store.lists.find((l) => l.id === listId)?.title ?? 'List';
  }

  // Navigasi waktu
  function prev() {
    const d = new Date(currentDate);
    if (viewType === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    currentDate = d;
  }

  function next() {
    const d = new Date(currentDate);
    if (viewType === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    currentDate = d;
  }

  function jumpToToday() {
    currentDate = new Date();
  }

  // Label rentang kalender di header
  const titleLabel = $derived.by<string>(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    if (viewType === 'month') {
      return `${MONTH_NAMES_ID[m]} ${y}`;
    } else {
      const days = getWeekDays(currentDate);
      const start = days[0].date;
      const end = days[6].date;
      return `${start.getDate()} ${MONTH_NAMES_ID[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES_ID[end.getMonth()]} ${end.getFullYear()}`;
    }
  });

  // Array hari kalender
  const calendarDays = $derived.by(() => {
    if (viewType === 'month') {
      return getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
    } else {
      return getWeekDays(currentDate);
    }
  });

  // Kartu aktif yang terfilter
  const activeCards = $derived.by<Card[]>(() => {
    return store.cards.filter((c) => {
      if (c.deleted_at) return false;
      if (selectedListId !== 'all' && c.list_id !== selectedListId) return false;
      return true;
    });
  });

  // Kartu yang dikelompokkan berdasarkan tanggal deadline (Key: YYYY-MM-DD)
  const cardsByDate = $derived.by<Record<string, Card[]>>(() => {
    const map: Record<string, Card[]> = {};
    activeCards.forEach((c) => {
      if (!c.deadline_date) return;
      const d = new Date(c.deadline_date);
      if (Number.isNaN(d.getTime())) return;
      const key = toDateKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });

    // Urutkan kartu dalam tiap hari berdasarkan jam tenggat waktu
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const ta = a.deadline_date ? new Date(a.deadline_date).getTime() : 0;
        const tb = b.deadline_date ? new Date(b.deadline_date).getTime() : 0;
        return ta - tb;
      });
    });

    return map;
  });

  // Kartu tanpa deadline
  const unscheduledCards = $derived.by<Card[]>(() => {
    const q = unscheduledSearch.trim().toLowerCase();
    return store.cards.filter((c) => {
      if (c.deleted_at) return false;
      if (c.deadline_date) return false;
      if (selectedListId !== 'all' && c.list_id !== selectedListId) return false;
      if (q && !c.title.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  // Format jam deadline (HH:mm)
  function formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // Drag and Drop Handlers
  function handleDragStart(e: DragEvent, card: Card) {
    draggedCardId = card.id;
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', card.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent, dateKey: string) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    dragOverDateKey = dateKey;
  }

  function handleDragLeave(dateKey: string) {
    if (dragOverDateKey === dateKey) {
      dragOverDateKey = null;
    }
  }

  async function handleDrop(e: DragEvent, targetDateKey: string) {
    e.preventDefault();
    dragOverDateKey = null;
    const cardId = draggedCardId || e.dataTransfer?.getData('text/plain');
    if (!cardId) return;

    const card = store.findCard(cardId);
    if (!card) return;

    const newIso = updateDateKeepingTime(card.deadline_date, targetDateKey);
    draggedCardId = null;

    const ok = await store.updateCard(card.id, { deadline_date: newIso });
    if (ok) {
      toast.success(`Jadwal "${card.title}" diatur ke ${formatDate(newIso)}`);
    } else {
      toast.error('Gagal memperbarui batas waktu');
    }
  }

  async function handleQuickAdd(dateKey: string) {
    const targetList = store.sortedLists[0];
    if (!targetList) {
      toast.error('Buat list terlebih dahulu.');
      return;
    }
    const [y, m, d] = dateKey.split('-').map(Number);
    const deadline = new Date(y, m - 1, d, 18, 0, 0).toISOString();
    const created = await store.addCard(targetList.id, 'Catatan Baru');
    if (created) {
      await store.updateCard(created.id, { deadline_date: deadline });
      onopen(created.id);
    }
  }
</script>

<div class="flex h-full w-full flex-1 overflow-hidden bg-slate-950 text-white select-none">
  <!-- Area Konten Utama Kalender -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Header Toolbar Kalender -->
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur-md">
      <!-- Kiri: Navigasi Tanggal & Bulan -->
      <div class="flex items-center gap-2">
        <div class="flex items-center rounded-xl border border-white/10 bg-white/5 p-1 shadow-xs">
          <button
            type="button"
            onclick={prev}
            class="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Sebelumnya"
          >
            <ChevronLeft class="size-4" />
          </button>
          <button
            type="button"
            onclick={jumpToToday}
            class="rounded-lg px-2.5 py-1 text-xs font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Lompat ke Hari Ini"
          >
            Hari Ini
          </button>
          <button
            type="button"
            onclick={next}
            class="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Berikutnya"
          >
            <ChevronRight class="size-4" />
          </button>
        </div>

        <div class="flex items-center gap-2 pl-2">
          <CalendarIcon class="size-5 text-indigo-400" />
          <h2 class="text-base sm:text-lg font-bold tracking-tight text-white drop-shadow-xs">{titleLabel}</h2>
        </div>
      </div>

      <!-- Kanan: Mode Switch, Filter List & Drawer Toggle -->
      <div class="flex items-center gap-2">
        <!-- Switch Tampilan: Bulan vs Minggu -->
        <div class="flex items-center rounded-xl border border-white/10 bg-white/5 p-1 text-xs shadow-xs">
          <button
            type="button"
            onclick={() => (viewType = 'month')}
            class="rounded-lg px-3 py-1 font-medium transition cursor-pointer {viewType === 'month'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-white/60 hover:text-white'}"
          >
            Bulan
          </button>
          <button
            type="button"
            onclick={() => (viewType = 'week')}
            class="rounded-lg px-3 py-1 font-medium transition cursor-pointer {viewType === 'week'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-white/60 hover:text-white'}"
          >
            Minggu
          </button>
        </div>

        <!-- Filter Kolom/List -->
        {#if store.lists.length > 0}
          <div class="relative hidden sm:block">
            <select
              bind:value={selectedListId}
              class="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all" class="bg-slate-900 text-white">Semua Kolom</option>
              {#each store.lists as list}
                <option value={list.id} class="bg-slate-900 text-white">{list.title}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Tombol Buka Drawer Tanpa Batas Waktu -->
        <button
          type="button"
          onclick={() => (showUnscheduledDrawer = !showUnscheduledDrawer)}
          class="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium transition cursor-pointer {showUnscheduledDrawer
            ? 'bg-indigo-600 text-white border-indigo-500'
            : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'}"
          title="Lihat kartu tanpa tenggat waktu"
        >
          <Inbox class="size-4 text-indigo-300" />
          <span class="hidden md:inline">Tanpa Jadwal</span>
          {#if unscheduledCards.length > 0}
            <span class="rounded-full bg-indigo-400/30 px-1.5 py-0.2 text-[10px] font-bold text-indigo-200">
              {unscheduledCards.length}
            </span>
          {/if}
        </button>
      </div>
    </header>

    <!-- Header Nama Hari (Senin - Minggu) -->
    <div class="grid grid-cols-7 border-b border-white/10 bg-slate-900/90 text-center text-xs font-semibold text-white/60">
      {#each DAY_NAMES_ID as dayName, idx}
        <div class="py-2.5 uppercase tracking-wider text-[11px] {idx >= 5 ? 'text-amber-400/70' : ''}">
          <span class="hidden sm:inline">{dayName}</span>
          <span class="sm:hidden">{SHORT_DAY_NAMES_ID[idx]}</span>
        </div>
      {/each}
    </div>

    <!-- Grid Kalender (Bulan / Minggu) -->
    <div class="flex-1 overflow-y-auto">
      {#if viewType === 'month'}
        <!-- 1. Tampilan Grid Bulanan -->
        <div class="grid grid-cols-7 auto-rows-fr h-full min-h-[550px] divide-x divide-y divide-white/10 bg-slate-950">
          {#each calendarDays as day (day.dateKey)}
            {@const dayCards = cardsByDate[day.dateKey] || []}
            {@const isDropTarget = dragOverDateKey === day.dateKey}
            <div
              role="group"
              aria-label={`Tanggal ${day.dateKey}`}
              ondragover={(e) => handleDragOver(e, day.dateKey)}
              ondragleave={() => handleDragLeave(day.dateKey)}
              ondrop={(e) => handleDrop(e, day.dateKey)}
              class="group relative flex flex-col p-1.5 sm:p-2 transition-colors min-h-[95px] {day.isCurrentMonth
                ? 'bg-slate-950/60 hover:bg-slate-900/40'
                : 'bg-slate-950/20 opacity-40'} {day.isToday ? 'ring-1 ring-inset ring-indigo-500/50 bg-indigo-950/10' : ''} {isDropTarget
                ? 'bg-indigo-950/70 ring-2 ring-indigo-400'
                : ''}"
            >
              <!-- Baris Atas Tanggal -->
              <div class="flex items-center justify-between">
                <span
                  class="flex size-6 items-center justify-center rounded-full text-xs font-medium {day.isToday
                    ? 'bg-indigo-600 font-bold text-white shadow-md ring-2 ring-indigo-400/40'
                    : day.isWeekend
                      ? 'text-amber-300/80'
                      : 'text-white/80'}"
                >
                  {day.dayNumber}
                </span>

                <!-- Tombol Cepat Tambah Kartu di Tanggal Ini -->
                <button
                  type="button"
                  onclick={() => handleQuickAdd(day.dateKey)}
                  class="opacity-0 group-hover:opacity-100 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white transition cursor-pointer"
                  title="Tambah kartu pada {formatDate(day.date.toISOString())}"
                >
                  <Plus class="size-3" />
                </button>
              </div>

              <!-- Daftar Kartu di Hari Ini -->
              <div class="mt-1 flex flex-1 flex-col gap-1 overflow-y-auto max-h-[140px] custom-scrollbar">
                {#each dayCards as card (card.id)}
                  {@const dl = deadlineState(card.deadline_date)}
                  <button
                    type="button"
                    draggable={true}
                    ondragstart={(e) => handleDragStart(e, card)}
                    onclick={() => onopen(card.id)}
                    class="flex w-full items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left text-xs transition cursor-grab active:cursor-grabbing shadow-xs {dl ===
                    'overdue'
                      ? 'border-red-500/40 bg-red-950/50 text-red-200 hover:bg-red-900/60'
                      : dl === 'soon'
                        ? 'border-amber-500/40 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60'
                        : 'border-white/10 bg-slate-900/90 text-white/90 hover:bg-slate-800'}"
                    title="{card.title} ({getListTitle(card.list_id)}) - Tenggat: {formatTime(card.deadline_date)}"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span
                        class="size-2 shrink-0 rounded-full"
                        style="background-color: {getListColor(card.list_id)}"
                      ></span>
                      <span class="truncate font-medium text-[11px]">{card.title}</span>
                    </div>

                    {#if card.deadline_date}
                      <span class="shrink-0 font-mono text-[10px] opacity-75">
                        {formatTime(card.deadline_date)}
                      </span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- 2. Tampilan Grid Mingguan (Week Columns) -->
        <div class="grid grid-cols-7 h-full min-h-[500px] divide-x divide-white/10 bg-slate-950">
          {#each calendarDays as day (day.dateKey)}
            {@const dayCards = cardsByDate[day.dateKey] || []}
            {@const isDropTarget = dragOverDateKey === day.dateKey}
            <div
              role="group"
              aria-label={`Hari ${day.dateKey}`}
              ondragover={(e) => handleDragOver(e, day.dateKey)}
              ondragleave={() => handleDragLeave(day.dateKey)}
              ondrop={(e) => handleDrop(e, day.dateKey)}
              class="flex flex-col p-2.5 transition-colors {day.isToday
                ? 'bg-indigo-950/15 ring-1 ring-inset ring-indigo-500/40'
                : 'hover:bg-slate-900/30'} {isDropTarget ? 'bg-indigo-950/70 ring-2 ring-indigo-400' : ''}"
            >
              <!-- Header Hari di Kolom Mingguan -->
              <div class="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                <div class="flex items-center gap-1.5">
                  <span
                    class="flex size-7 items-center justify-center rounded-full text-xs font-bold {day.isToday
                      ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-400/40'
                      : day.isWeekend
                        ? 'text-amber-300'
                        : 'text-white'}"
                  >
                    {day.dayNumber}
                  </span>
                  <span class="text-xs text-white/60 font-medium">
                    {MONTH_NAMES_ID[day.date.getMonth()].slice(0, 3)}
                  </span>
                </div>

                <button
                  type="button"
                  onclick={() => handleQuickAdd(day.dateKey)}
                  class="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white transition cursor-pointer"
                  title="Tambah kartu baru"
                >
                  <Plus class="size-3.5" />
                </button>
              </div>

              <!-- Daftar Kartu Hari Mingguan -->
              <div class="flex flex-1 flex-col gap-2 overflow-y-auto">
                {#if dayCards.length === 0}
                  <div class="flex flex-1 items-center justify-center text-center text-[11px] text-white/20 italic">
                    Kosong
                  </div>
                {:else}
                  {#each dayCards as card (card.id)}
                    {@const dl = deadlineState(card.deadline_date)}
                    <button
                      type="button"
                      draggable={true}
                      ondragstart={(e) => handleDragStart(e, card)}
                      onclick={() => onopen(card.id)}
                      class="flex flex-col gap-1 rounded-xl border p-2.5 text-left transition cursor-grab active:cursor-grabbing shadow-sm {dl ===
                      'overdue'
                        ? 'border-red-500/40 bg-red-950/60 text-red-100 hover:bg-red-900/70'
                        : dl === 'soon'
                          ? 'border-amber-500/40 bg-amber-950/60 text-amber-100 hover:bg-amber-900/70'
                          : 'border-white/10 bg-slate-900/90 text-white hover:bg-slate-800'}"
                    >
                      <div class="flex items-center justify-between gap-1">
                        <span
                          class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white/90"
                          style="background-color: {getListColor(card.list_id)}33; border: 1px solid {getListColor(
                            card.list_id
                          )}66;"
                        >
                          {getListTitle(card.list_id)}
                        </span>
                        {#if card.deadline_date}
                          <span class="flex items-center gap-1 font-mono text-[10px] text-white/60">
                            <Clock class="size-3" />
                            {formatTime(card.deadline_date)}
                          </span>
                        {/if}
                      </div>
                      <span class="font-medium text-xs line-clamp-2 mt-0.5">{card.title}</span>
                    </button>
                  {/each}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Drawer Samping: Kartu Tanpa Batas Waktu (Unscheduled Cards) -->
  {#if showUnscheduledDrawer}
    <aside
      class="flex w-72 sm:w-80 shrink-0 flex-col border-l border-white/10 bg-slate-900/95 p-4 backdrop-blur-xl shadow-2xl transition-all"
    >
      <!-- Header Drawer -->
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <div class="flex items-center gap-2">
          <Inbox class="size-4 text-indigo-400" />
          <h3 class="text-sm font-semibold text-white">Tanpa Tenggat Waktu</h3>
          <span class="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
            {unscheduledCards.length}
          </span>
        </div>
        <button
          type="button"
          onclick={() => (showUnscheduledDrawer = false)}
          class="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white transition cursor-pointer"
          title="Tutup"
        >
          <X class="size-4" />
        </button>
      </div>

      <p class="mt-2 text-xs text-white/50 leading-relaxed">
        Tarik (drag) kartu di bawah ini langsung ke tanggal di kalender untuk menjadwalkannya.
      </p>

      <!-- Input Pencarian Kartu Unscheduled -->
      <div class="mt-3">
        <input
          type="text"
          bind:value={unscheduledSearch}
          placeholder="Cari kartu tanpa jadwal..."
          class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/40 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <!-- List Kartu Unscheduled -->
      <div class="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {#if unscheduledCards.length === 0}
          <div class="flex h-36 flex-col items-center justify-center gap-1.5 text-center text-xs text-white/40">
            <Check class="size-6 text-emerald-400/60" />
            <span>Semua kartu sudah memiliki batas waktu!</span>
          </div>
        {:else}
          {#each unscheduledCards as card (card.id)}
            <button
              type="button"
              draggable={true}
              ondragstart={(e) => handleDragStart(e, card)}
              onclick={() => onopen(card.id)}
              class="flex w-full flex-col gap-1 rounded-xl border border-white/10 bg-slate-950/70 p-2.5 text-left transition hover:border-indigo-500/50 hover:bg-slate-950 cursor-grab active:cursor-grabbing shadow-2xs"
            >
              <div class="flex items-center justify-between gap-1">
                <span
                  class="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                  style="background-color: {getListColor(card.list_id)}33; color: {getListColor(card.list_id)};"
                >
                  {getListTitle(card.list_id)}
                </span>
                <span class="text-[10px] text-indigo-400 opacity-80">Tarik ke tanggal &rarr;</span>
              </div>
              <span class="font-medium text-xs text-white line-clamp-2">{card.title}</span>
            </button>
          {/each}
        {/if}
      </div>
    </aside>
  {/if}
</div>
