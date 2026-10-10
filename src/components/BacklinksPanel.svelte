<script lang="ts">
  import Link2 from '@lucide/svelte/icons/link-2';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import Plus from '@lucide/svelte/icons/plus';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';
  import { toast } from '../lib/toast.svelte';

  let {
    currentCard,
    store,
    onnavigate,
  }: {
    currentCard: Card;
    store: BoardStore;
    onnavigate: (cardId: string) => void;
  } = $props();

  let isOpen = $state(true);
  let activeTab = $state<'linked' | 'unlinked' | 'outgoing'>('linked');

  interface MentionItem {
    card: Card;
    listTitle: string;
    snippet: string;
  }

  function getListTitle(listId: string): string {
    return store.lists.find((l) => l.id === listId)?.title ?? 'List';
  }

  function getLineSnippet(content: string, keyword: string): string {
    const lines = content.split('\n');
    const lowerKeyword = keyword.toLowerCase();
    for (const line of lines) {
      if (line.toLowerCase().includes(lowerKeyword)) {
        return line.trim();
      }
    }
    return content.slice(0, 120);
  }

  // 1. Linked Mentions: Kartu lain yang menyematkan [[currentCard]]
  const linkedMentions = $derived.by<MentionItem[]>(() => {
    const activeCards = store.cards.filter((c) => !c.deleted_at && c.id !== currentCard.id);
    const targetTitle = currentCard.title.trim().toLowerCase();
    const targetId = currentCard.id.toLowerCase();
    const result: MentionItem[] = [];

    for (const card of activeCards) {
      const content = card.content || '';
      const regex = /\[\[(.*?)\]\]/g;
      let match;
      let isLinked = false;

      while ((match = regex.exec(content)) !== null) {
        const target = match[1].split('|')[0].trim().toLowerCase();
        if (target === targetTitle || target === targetId) {
          isLinked = true;
          break;
        }
      }

      if (isLinked) {
        result.push({
          card,
          listTitle: getListTitle(card.list_id),
          snippet: getLineSnippet(content, targetTitle) || `[[${currentCard.title}]]`,
        });
      }
    }

    return result;
  });

  // 2. Unlinked Mentions: Kartu lain yang menyebutkan judul kartu saat ini tanpa [[...]]
  const unlinkedMentions = $derived.by<MentionItem[]>(() => {
    const targetTitle = currentCard.title.trim();
    if (targetTitle.length < 3) return []; // Hindari false positive judul terlalu pendek

    const activeCards = store.cards.filter((c) => !c.deleted_at && c.id !== currentCard.id);
    const lowerTitle = targetTitle.toLowerCase();
    const result: MentionItem[] = [];

    for (const card of activeCards) {
      const content = card.content || '';
      // Hilangkan sementara semua [[...]] untuk mengecek teks biasa di luarnya
      const stripped = content.replace(/\[\[(.*?)\]\]/g, '   ');
      if (stripped.toLowerCase().includes(lowerTitle)) {
        result.push({
          card,
          listTitle: getListTitle(card.list_id),
          snippet: getLineSnippet(stripped, lowerTitle),
        });
      }
    }

    return result;
  });

  // 3. Outgoing Links: Kartu lain yang ditautkan oleh kartu saat ini
  const outgoingLinks = $derived.by<MentionItem[]>(() => {
    const content = currentCard.content || '';
    const regex = /\[\[(.*?)\]\]/g;
    const targets: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      targets.push(match[1].split('|')[0].trim().toLowerCase());
    }

    if (targets.length === 0) return [];

    const activeCards = store.cards.filter((c) => !c.deleted_at && c.id !== currentCard.id);
    const result: MentionItem[] = [];

    for (const card of activeCards) {
      if (targets.includes(card.id.toLowerCase()) || targets.includes(card.title.trim().toLowerCase())) {
        result.push({
          card,
          listTitle: getListTitle(card.list_id),
          snippet: `[[${card.title}]]`,
        });
      }
    }

    return result;
  });

  // Fungsi mengonversi kata unlinked menjadi [[Tautan]] secara otomatis
  async function convertToWikilink(targetCard: Card) {
    const rawContent = targetCard.content || '';
    const title = currentCard.title.trim();
    // Cari kemunculan kata title yang bukan di dalam [[ ]]
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!\\[\\[)(${escaped})(?!\\]\\])`, 'i');
    const updated = rawContent.replace(regex, `[[${title}]]`);

    if (updated !== rawContent) {
      const ok = await store.updateCard(targetCard.id, { content: updated });
      if (ok) {
        toast.success(`Tautan ke "${targetCard.title}" berhasil dibuat!`);
      } else {
        toast.error('Gagal memperbarui catatan.');
      }
    }
  }
</script>

<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition-colors">
  <!-- Accordion Toggle Header -->
  <button
    type="button"
    class="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
    onclick={() => (isOpen = !isOpen)}
  >
    <div class="flex items-center gap-2">
      <Link2 class="size-4 text-brand-600" />
      <span class="tracking-wide uppercase text-[11px] font-bold text-slate-600">Tautan Balik (Backlinks)</span>
      <span class="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
        {linkedMentions.length} Terhubung • {unlinkedMentions.length} Disebut
      </span>
    </div>
    <div class="text-slate-400">
      {#if isOpen}
        <ChevronDown class="size-4" />
      {:else}
        <ChevronRight class="size-4" />
      {/if}
    </div>
  </button>

  {#if isOpen}
    <div class="mt-3 space-y-3">
      <!-- Tab Navigasi -->
      <div class="flex items-center gap-1 border-b border-slate-200 pb-1.5 text-xs">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer {activeTab === 'linked'
            ? 'bg-brand-600 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-200/60'}"
          onclick={() => (activeTab = 'linked')}
        >
          <ArrowDownLeft class="size-3.5" />
          <span>Tautan Masuk ({linkedMentions.length})</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer {activeTab === 'unlinked'
            ? 'bg-brand-600 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-200/60'}"
          onclick={() => (activeTab = 'unlinked')}
        >
          <span>Penyebutan Tak Tertaut ({unlinkedMentions.length})</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer {activeTab === 'outgoing'
            ? 'bg-brand-600 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-200/60'}"
          onclick={() => (activeTab = 'outgoing')}
        >
          <ArrowUpRight class="size-3.5" />
          <span>Tautan Keluar ({outgoingLinks.length})</span>
        </button>
      </div>

      <!-- Isi Tab: 1. Linked Mentions -->
      {#if activeTab === 'linked'}
        {#if linkedMentions.length === 0}
          <p class="py-2 text-center text-xs text-slate-400 italic">
            Belum ada catatan lain yang menautkan kartu ini. Tulis <code>[[{currentCard.title}]]</code> di catatan lain untuk menghubungkan.
          </p>
        {:else}
          <div class="space-y-2">
            {#each linkedMentions as item (item.card.id)}
              <div class="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs hover:border-brand-300 transition-colors">
                <div class="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    class="font-semibold text-xs text-brand-700 hover:underline cursor-pointer truncate text-left"
                    onclick={() => onnavigate(item.card.id)}
                    title="Buka catatan {item.card.title}"
                  >
                    {item.card.title}
                  </button>
                  <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 shrink-0">
                    {item.listTitle}
                  </span>
                </div>
                <div class="mt-1.5 border-l-2 border-brand-400 pl-2 text-[11px] text-slate-600 font-mono italic truncate">
                  "{item.snippet}"
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}

      <!-- Isi Tab: 2. Unlinked Mentions -->
      {#if activeTab === 'unlinked'}
        {#if unlinkedMentions.length === 0}
          <p class="py-2 text-center text-xs text-slate-400 italic">
            Tidak ada penyebutan nama kartu ini di catatan lain.
          </p>
        {:else}
          <div class="space-y-2">
            {#each unlinkedMentions as item (item.card.id)}
              <div class="rounded-lg border border-amber-200/80 bg-amber-50/40 p-2.5 shadow-2xs">
                <div class="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    class="font-semibold text-xs text-slate-800 hover:text-brand-600 cursor-pointer truncate text-left"
                    onclick={() => onnavigate(item.card.id)}
                  >
                    {item.card.title}
                  </button>
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-md bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white shadow-xs hover:bg-brand-700 transition cursor-pointer shrink-0"
                    onclick={() => convertToWikilink(item.card)}
                    title="Jadikan tautan [[{currentCard.title}]]"
                  >
                    <Plus class="size-3" />
                    <span>Tautkan</span>
                  </button>
                </div>
                <div class="mt-1.5 border-l-2 border-amber-400 pl-2 text-[11px] text-slate-600 italic truncate">
                  "{item.snippet}"
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}

      <!-- Isi Tab: 3. Outgoing Links -->
      {#if activeTab === 'outgoing'}
        {#if outgoingLinks.length === 0}
          <p class="py-2 text-center text-xs text-slate-400 italic">
            Kartu ini belum menautkan catatan lain. Ketik <code>[[Nama Catatan]]</code> di editor untuk membuat tautan keluar.
          </p>
        {:else}
          <div class="space-y-2">
            {#each outgoingLinks as item (item.card.id)}
              <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-2xs hover:border-brand-300">
                <button
                  type="button"
                  class="font-semibold text-brand-700 hover:underline cursor-pointer truncate text-left"
                  onclick={() => onnavigate(item.card.id)}
                >
                  {item.card.title}
                </button>
                <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {item.listTitle}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
