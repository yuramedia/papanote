<script lang="ts">
  import { Dialog, Switch } from 'bits-ui';
  import X from '@lucide/svelte/icons/x';
  import Check from '@lucide/svelte/icons/check';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import History from '@lucide/svelte/icons/history';
  import Bell from '@lucide/svelte/icons/bell';
  import Eye from '@lucide/svelte/icons/eye';
  import Pencil from '@lucide/svelte/icons/pencil';
  import HistoryPanel from './HistoryPanel.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import BacklinksPanel from './BacklinksPanel.svelte';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';
  import { deadlineState, formatDateTime, fromLocalInput, toLocalInput } from '../lib/format';
  import { enablePush, pushMessage } from '../lib/push';
  import { toast } from '../lib/toast.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import { router } from '../lib/router.svelte';

  let { card, store, onclose }: { card: Card; store: BoardStore; onclose: () => void } = $props();

  // Draft lokal; disinkronkan dari realtime selama field tidak sedang difokuskan.
  let title = $state('');
  let content = $state('');
  let focused = $state<'title' | 'content' | null>(null);
  let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let showHistory = $state(false);
  let confirmOpen = $state(false);
  // Mode tampilan catatan: preview (Obsidian view) vs edit (Markdown raw)
  let mode = $state<'preview' | 'edit'>('preview');

  $effect(() => {
    const c = card;
    if (focused !== 'title') title = c.title;
    if (focused !== 'content') content = c.content ?? '';
  });

  const listTitle = $derived(store.lists.find((l) => l.id === card.list_id)?.title ?? '');
  const dl = $derived(deadlineState(card.deadline_date));

  async function save(patch: Partial<Pick<Card, 'title' | 'content' | 'deadline_date' | 'enable_notification'>>) {
    saveState = 'saving';
    const ok = await store.updateCard(card.id, patch);
    saveState = ok ? 'saved' : 'error';
    if (ok) setTimeout(() => saveState === 'saved' && (saveState = 'idle'), 2000);
  }

  // Auto-save saat kursor keluar dari area ketik (on-blur)
  function blurTitle() {
    const v = title.trim();
    if (v && v !== card.title) save({ title: v });
    else title = card.title;
    focused = null;
  }
  function blurContent() {
    if (content !== (card.content ?? '')) save({ content });
    focused = null;
  }

  async function toggleNotification(on: boolean) {
    if (on) {
      const result = await enablePush();
      if (result !== 'enabled') toast.error(pushMessage(result));
    }
    await save({ enable_notification: on });
  }

  function handleWikilinkClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('[data-wikilink]') as HTMLElement | null;
    if (!target) return;
    e.preventDefault();
    const rawTarget = decodeURIComponent(target.getAttribute('data-wikilink') || '').trim();
    if (!rawTarget) return;

    // Cari kartu berdasarkan id atau judul persis / case-insensitive
    const match = store.cards.find(
      (c) => c.id === rawTarget || c.title.toLowerCase() === rawTarget.toLowerCase(),
    );
    if (match) {
      router.go(`/board/${store.board?.id}/card/${match.id}`);
    } else {
      toast.show(`Kartu "${rawTarget}" belum ditemukan di papan ini.`, 'info');
    }
  }
</script>

<Dialog.Root open onOpenChange={(o) => !o && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-40 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
    >
      <div class="flex items-start gap-3 border-b border-slate-100 p-5 pb-4">
        <div class="min-w-0 flex-1">
          <Dialog.Title class="sr-only">Detail kartu</Dialog.Title>
          <input
            class="w-full rounded-md border border-transparent px-1 py-0.5 text-lg font-semibold text-slate-900 hover:border-slate-200 focus:border-brand-500 focus:outline-none"
            bind:value={title}
            onfocus={() => (focused = 'title')}
            onblur={blurTitle}
            onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            maxlength="300"
            aria-label="Judul kartu"
          />
          <Dialog.Description class="mt-1 px-1 text-xs text-slate-500">
            di list <span class="font-medium text-slate-700">{listTitle}</span> · Diunggah {formatDateTime(card.uploaded_at)}
          </Dialog.Description>
        </div>
        <span class="flex h-8 items-center gap-1 text-xs text-slate-500" aria-live="polite">
          {#if saveState === 'saving'}<LoaderCircle class="size-3.5 animate-spin" /> Menyimpan…
          {:else if saveState === 'saved'}<Check class="size-3.5 text-emerald-600" /> Tersimpan
          {:else if saveState === 'error'}<span class="text-red-600">Gagal menyimpan</span>{/if}
        </span>
        <Dialog.Close class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
          <X class="size-5" />
        </Dialog.Close>
      </div>

      <div class="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_14rem]">
        <div class="min-w-0">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Catatan Markdown</span>
            <div class="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition {mode === 'preview' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
                onclick={() => (mode = 'preview')}
              >
                <Eye class="size-3.5" /> Preview
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition {mode === 'edit' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
                onclick={() => (mode = 'edit')}
              >
                <Pencil class="size-3.5" /> Edit
              </button>
            </div>
          </div>

          {#if mode === 'preview'}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="markdown-body min-h-64 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300"
              onclick={handleWikilinkClick}
            >
              {@html renderMarkdown(content)}
            </div>
            <p class="mt-1.5 text-right text-[11px] text-slate-400">
              Mendukung syntax Markdown standar &amp; wikilinks <code>[[Nama Kartu]]</code>
            </p>
          {:else}
            <div class="space-y-1.5">
              <textarea
                id="card-content"
                class="input min-h-64 resize-y font-mono text-[13px] leading-relaxed"
                placeholder="Tulis catatan Markdown… Gunakan # Judul, - [ ] Checklist, atau [[Nama Kartu Lain]] untuk menghubungkan catatan."
                bind:value={content}
                onfocus={() => (focused = 'content')}
                onblur={blurContent}
              ></textarea>
              <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>Tips: Gunakan <code>[[Nama Kartu]]</code> untuk membuat tautan dua arah ala Obsidian.</span>
                <button type="button" class="text-brand-600 font-medium underline" onclick={() => (mode = 'preview')}>
                  Selesai mengedit &rarr;
                </button>
              </div>
            </div>
          {/if}

          <button class="btn-ghost mt-3 -ml-2" onclick={() => (showHistory = !showHistory)}>
            <History class="size-4" />
            {showHistory ? 'Sembunyikan riwayat' : 'Lihat riwayat perubahan'}
          </button>
          {#if showHistory}
            <div class="mt-2">
              <HistoryPanel
                cardId={card.id}
                refreshKey={card.updated_at}
                onrestore={(old) => {
                  content = old;
                  save({ content: old });
                  toast.success('Versi lama dipulihkan.');
                }}
              />
            </div>
          {/if}

          <!-- Panel Tautan Balik (Obsidian Backlinks) -->
          <BacklinksPanel
            currentCard={card}
            {store}
            onnavigate={(targetId) => {
              router.go(`/board/${store.board?.id}/card/${targetId}`);
            }}
          />
        </div>

        <aside class="space-y-5">
          <div>
            <label for="card-deadline" class="mb-1.5 block text-sm font-medium text-slate-700">Tenggat waktu</label>
            <input
              id="card-deadline"
              type="datetime-local"
              class="input"
              value={toLocalInput(card.deadline_date)}
              onchange={(e) => save({ deadline_date: fromLocalInput(e.currentTarget.value) })}
            />
            {#if card.deadline_date}
              <div class="mt-1.5 flex items-center justify-between text-xs">
                <span
                  class={dl === 'overdue' ? 'text-red-600' : dl === 'soon' ? 'text-amber-700' : 'text-slate-500'}
                >
                  {dl === 'overdue' ? 'Sudah lewat' : dl === 'soon' ? 'Kurang dari 24 jam' : 'Terjadwal'}
                </span>
                <button class="text-slate-500 underline hover:text-slate-800" onclick={() => save({ deadline_date: null })}>
                  Hapus
                </button>
              </div>
            {/if}
          </div>

          <div class="rounded-xl border border-slate-200 p-3">
            <div class="flex items-center justify-between gap-2">
              <label for="card-notify" class="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Bell class="size-4" /> Notifikasi
              </label>
              <Switch.Root
                id="card-notify"
                checked={card.enable_notification}
                onCheckedChange={toggleNotification}
                class="inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-slate-300 px-0.5 transition data-[state=checked]:bg-brand-600"
              >
                <Switch.Thumb
                  class="block size-5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5"
                />
              </Switch.Root>
            </div>
            <p class="mt-2 text-xs text-slate-500">
              Pengingat 24 jam &amp; 1 jam sebelum tenggat, serta saat kartu diubah anggota lain.
            </p>
          </div>

          <div class="text-xs text-slate-500">
            <p>Diunggah: {formatDateTime(card.uploaded_at)}</p>
            <p>Diperbarui: {formatDateTime(card.updated_at)}</p>
          </div>

          <button class="btn w-full text-red-600 hover:bg-red-50" onclick={() => (confirmOpen = true)}>
            <Trash2 class="size-4" /> Hapus kartu
          </button>
        </aside>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus kartu?"
  description={`Kartu "${card.title}" akan dihapus dari papan. Salinan tetap tersimpan di database internal.`}
  onconfirm={async () => {
    onclose();
    await store.updateCard(card.id, { deleted_at: new Date().toISOString() });
  }}
/>
