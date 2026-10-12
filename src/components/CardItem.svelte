<script lang="ts">
  import Bell from '@lucide/svelte/icons/bell';
  import CalendarClock from '@lucide/svelte/icons/calendar-clock';
  import { deadlineState, formatDate, formatDateTime } from '../lib/format';
  import { extractFirstImage, cleanSnippet } from '../lib/attachments';
  import { extractTags, getTagColor } from '../lib/tags';
  import type { Card } from '../lib/types';

  let {
    card,
    onopen,
    onTagClick,
  }: {
    card: Card;
    onopen: (id: string) => void;
    onTagClick?: (tag: string) => void;
  } = $props();

  const state = $derived(deadlineState(card.deadline_date));
  const coverUrl = $derived(extractFirstImage(card.content));
  const snippet = $derived(cleanSnippet(card.content));
  const tags = $derived(extractTags(card.content));

  const badge = {
    none: '',
    normal: 'bg-slate-100 text-slate-600',
    soon: 'bg-amber-100 text-amber-800',
    overdue: 'bg-red-100 text-red-700',
  } as const;
</script>

<button
  class="group block w-full rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-brand-300 hover:shadow overflow-hidden cursor-pointer"
  onclick={() => onopen(card.id)}
>
  {#if coverUrl}
    <div class="relative h-32 w-full overflow-hidden bg-slate-100 border-b border-slate-100">
      <img
        src={coverUrl}
        alt={card.title}
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
    </div>
  {/if}

  <div class="p-3">
    <p class="text-sm font-medium break-words text-slate-900 group-hover:text-brand-700 transition-colors">
      {card.title}
    </p>
    {#if snippet}
      <p class="mt-1 line-clamp-2 text-xs break-words whitespace-pre-line text-slate-500 font-mono">
        {snippet}
      </p>
    {/if}

    {#if tags.length > 0}
      <div class="mt-2 flex flex-wrap items-center gap-1">
        {#each tags.slice(0, 3) as tag (tag)}
          {@const style = getTagColor(tag)}
          <span
            role="button"
            tabindex="0"
            class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium border transition cursor-pointer {style.bg} {style.text} {style.border} hover:opacity-80"
            onclick={(e) => {
              if (onTagClick) {
                e.stopPropagation();
                onTagClick(tag);
              }
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter' && onTagClick) {
                e.stopPropagation();
                onTagClick(tag);
              }
            }}
            title={`Filter #${tag}`}
          >
            <span class="opacity-60">#</span>{tag}
          </span>
        {/each}
        {#if tags.length > 3}
          <span class="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500">
            +{tags.length - 3}
          </span>
        {/if}
      </div>
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
  </div>
</button>
