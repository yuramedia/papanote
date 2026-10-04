<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import { deadlineState, formatDate, formatDateTime } from '../lib/format';
  import type { Card } from '../lib/types';

  let { card, onopen }: { card: Card; onopen: (id: string) => void } = $props();

  const state = $derived(deadlineState(card.deadline_date));
  const badge = {
    none: '',
    normal: 'bg-slate-100 text-slate-600',
    soon: 'bg-amber-100 text-amber-800',
    overdue: 'bg-red-100 text-red-700',
  } as const;
</script>

<button
  class="block w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-300 hover:shadow"
  onclick={() => onopen(card.id)}
>
  <p class="text-sm font-medium break-words text-slate-900">{card.title}</p>
  {#if card.content}
    <p class="mt-1 line-clamp-2 text-xs break-words whitespace-pre-line text-slate-500">{card.content}</p>
  {/if}
  <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
    <span class="text-slate-400" title="Diunggah {formatDateTime(card.uploaded_at)}">
      {formatDate(card.uploaded_at)}
    </span>
    {#if card.deadline_date}
      <span class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium {badge[state]}">
        <CalendarClock class="size-3" />
        {formatDateTime(card.deadline_date)}
      </span>
    {/if}
    {#if card.enable_notification}
      <Bell class="size-3.5 text-brand-600" aria-label="Notifikasi aktif" />
    {/if}
  </div>
</button>
