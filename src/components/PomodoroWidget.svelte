<script lang="ts">
  import { Popover } from 'bits-ui';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Timer from '@lucide/svelte/icons/timer';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import VolumeX from '@lucide/svelte/icons/volume-x';
  import FileText from '@lucide/svelte/icons/file-text';
  import X from '@lucide/svelte/icons/x';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import BookmarkCheck from '@lucide/svelte/icons/bookmark-check';
  import { pomodoro } from '../lib/pomodoro.svelte';
  import { MODE_LABELS, MODE_ICONS } from '../lib/pomodoro';
  import type { BoardStore } from '../lib/board.svelte';

  let {
    store,
    onopenCard,
  }: {
    store: BoardStore;
    onopenCard?: (cardId: string) => void;
  } = $props();

  let popoverOpen = $state(false);

  // Daftar kartu yang tersedia di papan untuk dijadikan target fokus
  const activeCards = $derived(store.cards.filter((c) => !c.deleted_at));

  function handleLogSession() {
    if (pomodoro.cardId) {
      pomodoro.logSessionToCard(store);
    }
  }
</script>

<Popover.Root bind:open={popoverOpen}>
  <Popover.Trigger
    class="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer select-none border {pomodoro.isRunning
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm animate-pulse'
      : pomodoro.isPaused
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        : pomodoro.isCompleted
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          : 'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white border-white/10'}"
    title="Timer Pomodoro & Fokus Kerja"
  >
    <span class="text-sm">{MODE_ICONS[pomodoro.mode]}</span>
    <span class="font-mono tracking-tight">{pomodoro.formattedTime}</span>

    {#if pomodoro.isRunning}
      <button
        type="button"
        onclick={(e) => {
          e.stopPropagation();
          pomodoro.pause();
        }}
        class="ml-0.5 rounded p-0.5 hover:bg-white/20 transition cursor-pointer"
        title="Jeda timer"
      >
        <Pause class="size-3" />
      </button>
    {:else if pomodoro.isPaused}
      <button
        type="button"
        onclick={(e) => {
          e.stopPropagation();
          pomodoro.resume();
        }}
        class="ml-0.5 rounded p-0.5 hover:bg-white/20 transition cursor-pointer"
        title="Lanjutkan timer"
      >
        <Play class="size-3" />
      </button>
    {/if}
  </Popover.Trigger>

  <Popover.Portal>
    <Popover.Content
      align="end"
      sideOffset={8}
      class="z-50 w-80 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- 1. Header Mode Tabs -->
      <div class="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div class="flex items-center gap-1 p-0.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs w-full">
          <button
            type="button"
            onclick={() => pomodoro.switchMode('focus')}
            class="flex-1 py-1 rounded-lg font-medium transition cursor-pointer text-center {pomodoro.mode === 'focus'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'}"
          >
            🍅 Fokus
          </button>
          <button
            type="button"
            onclick={() => pomodoro.switchMode('short_break')}
            class="flex-1 py-1 rounded-lg font-medium transition cursor-pointer text-center {pomodoro.mode === 'short_break'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'}"
          >
            ☕ Rehat
          </button>
          <button
            type="button"
            onclick={() => pomodoro.switchMode('long_break')}
            class="flex-1 py-1 rounded-lg font-medium transition cursor-pointer text-center {pomodoro.mode === 'long_break'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'}"
          >
            🛋️ Santai
          </button>
        </div>
      </div>

      <!-- 2. Big Timer Display & Progress -->
      <div class="text-center py-2">
        <span class="text-xs uppercase tracking-wider font-semibold {pomodoro.mode === 'focus' ? 'text-rose-400' : 'text-amber-400'}">
          {MODE_LABELS[pomodoro.mode]}
        </span>
        <div class="text-4xl font-extrabold font-mono tracking-tight my-1 text-white">
          {pomodoro.formattedTime}
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-slate-800 rounded-full h-2 my-2 overflow-hidden border border-white/5">
          <div
            class="h-full transition-all duration-300 rounded-full {pomodoro.mode === 'focus'
              ? 'bg-gradient-to-r from-rose-500 to-amber-500'
              : 'bg-gradient-to-r from-amber-500 to-emerald-500'}"
            style="width: {pomodoro.progress}%"
          ></div>
        </div>
      </div>

      <!-- 3. Target Catatan Aktif -->
      <div class="rounded-xl border border-white/10 bg-slate-950/60 p-2.5 my-2 text-xs">
        <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span class="flex items-center gap-1">
            <FileText class="size-3 text-indigo-400" />
            <span>Target Catatan:</span>
          </span>
          {#if pomodoro.cardId}
            <button
              type="button"
              onclick={() => pomodoro.detachCard()}
              class="text-slate-500 hover:text-rose-400 transition cursor-pointer"
              title="Lepas target catatan"
            >
              <X class="size-3" />
            </button>
          {/if}
        </div>

        {#if pomodoro.cardId}
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-slate-200 truncate">{pomodoro.cardTitle}</span>
            <button
              type="button"
              onclick={() => {
                if (pomodoro.cardId) {
                  popoverOpen = false;
                  onopenCard?.(pomodoro.cardId);
                }
              }}
              class="text-indigo-400 hover:text-indigo-300 shrink-0 cursor-pointer"
              title="Buka catatan ini"
            >
              <ExternalLink class="size-3.5" />
            </button>
          </div>
        {:else}
          <select
            onchange={(e) => {
              const id = e.currentTarget.value;
              if (id) {
                const c = store.findCard(id);
                if (c) pomodoro.attachCard(c.id, c.title);
              }
            }}
            class="w-full bg-transparent text-slate-400 text-xs focus:outline-none cursor-pointer"
          >
            <option value="" class="bg-slate-900 text-slate-400">+ Hubungkan ke catatan…</option>
            {#each activeCards as c (c.id)}
              <option value={c.id} class="bg-slate-900 text-white truncate">
                {c.title}
              </option>
            {/each}
          </select>
        {/if}
      </div>

      <!-- 4. Play / Pause / Reset Actions -->
      <div class="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-white/10">
        <button
          type="button"
          onclick={() => pomodoro.toggle()}
          class="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-md transition cursor-pointer {pomodoro.isRunning
            ? 'bg-amber-600 hover:bg-amber-500 text-white'
            : 'bg-rose-600 hover:bg-rose-500 text-white'}"
        >
          {#if pomodoro.isRunning}
            <Pause class="size-3.5" />
            <span>Jeda</span>
          {:else if pomodoro.isPaused}
            <Play class="size-3.5" />
            <span>Lanjutkan</span>
          {:else}
            <Play class="size-3.5" />
            <span>Mulai</span>
          {/if}
        </button>

        <button
          type="button"
          onclick={() => pomodoro.reset()}
          class="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-2 text-slate-300 hover:text-white transition cursor-pointer"
          title="Reset timer"
        >
          <RotateCcw class="size-3.5" />
        </button>

        {#if pomodoro.cardId}
          <button
            type="button"
            onclick={handleLogSession}
            class="rounded-xl border border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-900/60 p-2 text-indigo-300 hover:text-white transition cursor-pointer"
            title="Catat sesi fokus ke dalam catatan"
          >
            <BookmarkCheck class="size-3.5" />
          </button>
        {/if}
      </div>

      <!-- 5. Footer Stats & Sound Toggle -->
      <div class="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-white/10">
        <div class="flex items-center gap-1 text-slate-300">
          <span>🍅 {pomodoro.completedPomodoros} sesi hari ini</span>
        </div>

        <button
          type="button"
          onclick={() => (pomodoro.soundEnabled = !pomodoro.soundEnabled)}
          class="flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
          title={pomodoro.soundEnabled ? 'Suara notifikasi aktif' : 'Suara notifikasi dimatikan'}
        >
          {#if pomodoro.soundEnabled}
            <Volume2 class="size-3.5 text-emerald-400" />
            <span>Suara Aktif</span>
          {:else}
            <VolumeX class="size-3.5 text-slate-500" />
            <span>Mute</span>
          {/if}
        </button>
      </div>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
