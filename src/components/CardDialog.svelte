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
  import FileText from '@lucide/svelte/icons/file-text';
  import Plus from '@lucide/svelte/icons/plus';
  import ImageIcon from '@lucide/svelte/icons/image';
  import HistoryPanel from './HistoryPanel.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import BacklinksPanel from './BacklinksPanel.svelte';
  import LocalGraphPanel from './LocalGraphPanel.svelte';
  import WikilinkPreviewPopover from './WikilinkPreviewPopover.svelte';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';
  import { deadlineState, formatDateTime, fromLocalInput, toLocalInput } from '../lib/format';
  import { extractFirstImage, uploadAttachment, insertImageMarkdown } from '../lib/attachments';
  import { enablePush, pushMessage } from '../lib/push';
  import { toast } from '../lib/toast.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import Tag from '@lucide/svelte/icons/tag';
  import LayoutTemplate from '@lucide/svelte/icons/layout-template';
  import Users from '@lucide/svelte/icons/users';
  import Bug from '@lucide/svelte/icons/bug';
  import Rocket from '@lucide/svelte/icons/rocket';
  import Sun from '@lucide/svelte/icons/sun';
  import { extractTags, getTagColor } from '../lib/tags';
  import { router } from '../lib/router.svelte';
  import TemplatePickerModal from './TemplatePickerModal.svelte';
  import { getBuiltinTemplates, applyTemplate, type NoteTemplate } from '../lib/templates';

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

  // Modal template catatan
  let templateModalOpen = $state(false);

  function applyQuickTemplate(templateId: string) {
    const t = getBuiltinTemplates().find((item) => item.id === templateId);
    if (!t) return;
    const res = applyTemplate(t, { currentContent: content, append: false });
    const patch: Partial<Pick<Card, 'title' | 'content'>> = { content: res.content };
    content = res.content;
    if (!title.trim() || title === 'Catatan Baru' || title === 'Note') {
      title = res.title;
      patch.title = res.title;
    }
    mode = 'edit';
    save(patch);
    toast.success(`Template "${t.name}" diterapkan.`);
  }

  function handleTemplateApplied(res: { title: string; content: string; template: NoteTemplate }) {
    const patch: Partial<Pick<Card, 'title' | 'content'>> = { content: res.content };
    content = res.content;
    if (!title.trim() || title === 'Catatan Baru' || title === 'Note') {
      title = res.title;
      patch.title = res.title;
    }
    mode = 'edit';
    save(patch);
  }

  // Lampiran Gambar & Cover Kartu
  let isUploadingImage = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  const coverUrl = $derived(extractFirstImage(content));

  // Sistem Tagar & Label
  const activeCardTags = $derived(extractTags(content));
  const quickTags = $derived.by<string[]>(() => {
    const list = store.allTags.map((t) => t.tag);
    const defaults = ['urgent', 'p1', 'wip', 'done', 'idea', 'review'];
    const merged = Array.from(new Set([...list, ...defaults]));
    return merged.slice(0, 8);
  });

  function insertTag(tagName: string) {
    const tagText = `#${tagName} `;
    if (!textareaEl) {
      content = content ? `${content} ${tagText}` : tagText;
      save({ content });
      return;
    }
    const start = textareaEl.selectionStart ?? content.length;
    const end = textareaEl.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const needLeadingSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    content = before + (needLeadingSpace ? ' ' : '') + tagText + after;
    save({ content });
    setTimeout(() => {
      textareaEl?.focus();
      const pos = start + tagText.length + (needLeadingSpace ? 1 : 0);
      textareaEl?.setSelectionRange(pos, pos);
    }, 10);
  }

  // Autocomplete Wikilinks [[
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let suggestContainerEl = $state<HTMLDivElement | null>(null);
  let showSuggest = $state(false);
  let suggestQuery = $state('');
  let suggestIndex = $state(0);
  let suggestStartPos = $state(0);

  const suggestCards = $derived.by<Card[]>(() => {
    if (!showSuggest) return [];
    const q = suggestQuery.trim().toLowerCase();
    const others = store.cards.filter((c) => !c.deleted_at && c.id !== card.id);
    if (!q) return others.slice(0, 8);
    return others.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 8);
  });

  const canCreateNew = $derived.by<boolean>(() => {
    if (!showSuggest) return false;
    const q = suggestQuery.trim();
    if (!q) return false;
    return !store.cards.some((c) => !c.deleted_at && c.title.toLowerCase() === q.toLowerCase());
  });

  function scrollToActiveSuggest() {
    setTimeout(() => {
      const activeEl = suggestContainerEl?.querySelector('[data-active="true"]') as HTMLElement | null;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }, 10);
  }

  function handleTextareaInput() {
    if (!textareaEl) return;
    const cursorPos = textareaEl.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);

    // Cari pola [[ diikuti kata tanpa kurung tutup ]] pada baris saat ini
    const match = textBeforeCursor.match(/\[\[([^\]\n]*)$/);
    if (match) {
      showSuggest = true;
      suggestQuery = match[1];
      suggestStartPos = cursorPos - match[0].length;
      suggestIndex = 0;
    } else {
      showSuggest = false;
    }
  }

  function handleTextareaKeyDown(e: KeyboardEvent) {
    if (!showSuggest) return;
    const totalOptions = suggestCards.length + (canCreateNew ? 1 : 0);
    if (totalOptions === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      suggestIndex = (suggestIndex + 1) % totalOptions;
      scrollToActiveSuggest();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      suggestIndex = (suggestIndex - 1 + totalOptions) % totalOptions;
      scrollToActiveSuggest();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (suggestIndex < suggestCards.length) {
        applySuggestion(suggestCards[suggestIndex].title);
      } else if (canCreateNew) {
        applySuggestion(suggestQuery.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      showSuggest = false;
    }
  }

  function applySuggestion(chosenTitle: string) {
    if (!textareaEl) return;
    const cursorPos = textareaEl.selectionStart;
    const before = content.slice(0, suggestStartPos);
    const after = content.slice(cursorPos);
    const hasClosing = after.startsWith(']]');
    const cleanAfter = hasClosing ? after.slice(2) : after;
    const inserted = `[[${chosenTitle}]] `;
    content = before + inserted + cleanAfter;
    showSuggest = false;
    save({ content });

    const newCursor = suggestStartPos + inserted.length;
    setTimeout(() => {
      textareaEl?.focus();
      textareaEl?.setSelectionRange(newCursor, newCursor);
    }, 10);
  }

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

  async function processImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Berkas harus berupa gambar.');
      return;
    }
    isUploadingImage = true;
    try {
      toast.info('Menyiapkan gambar...');
      const { url, name } = await uploadAttachment(file, `board_${store.board?.id || 'main'}/card_${card.id}`);
      const cursorPos = textareaEl ? textareaEl.selectionStart : undefined;
      const { newContent, newCursor } = insertImageMarkdown(content, url, name, cursorPos);
      content = newContent;
      await save({ content: newContent });
      toast.success('Gambar berhasil disisipkan!');

      if (mode === 'edit' && textareaEl) {
        setTimeout(() => {
          textareaEl?.focus();
          textareaEl?.setSelectionRange(newCursor, newCursor);
        }, 20);
      }
    } catch (err) {
      toast.error(`Gagal menyisipkan gambar: ${(err as Error).message}`);
    } finally {
      isUploadingImage = false;
    }
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    processImageFile(files[0]);
    input.value = '';
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file);
          break;
        }
      }
    }
  }

  function handleFileDrop(e: DragEvent) {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      e.preventDefault();
      processImageFile(files[0]);
    }
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
    // Beri jeda agar klik pada saran autocomplete tidak tertutup mendadak
    setTimeout(() => (showSuggest = false), 200);
  }

  async function toggleNotification(on: boolean) {
    if (on) {
      const result = await enablePush();
      if (result !== 'enabled') toast.error(pushMessage(result));
    }
    await save({ enable_notification: on });
  }

  // Hover Preview Popover (Obsidian Page Preview)
  let previewTargetCard = $state<Card | null>(null);
  let previewPosition = $state<{ x: number; y: number; placeAbove?: boolean }>({ x: 0, y: 0 });
  let previewVisible = $state(false);
  let hoverTimer: number | null = null;
  let closeTimer: number | null = null;

  function handleWikilinkClick(e: MouseEvent) {
    const tagEl = (e.target as HTMLElement).closest('[data-tag]') as HTMLElement | null;
    if (tagEl) {
      const tagName = tagEl.getAttribute('data-tag');
      if (tagName) {
        store.toggleTag(tagName);
        toast.show(`Filter tag #${tagName} diaktifkan di papan.`, 'info');
      }
      return;
    }

    const target = (e.target as HTMLElement).closest('[data-wikilink]') as HTMLElement | null;
    if (!target) return;
    e.preventDefault();
    previewVisible = false;
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

  function handleWikilinkMouseOver(e: MouseEvent) {
    const linkEl = (e.target as HTMLElement).closest('[data-wikilink]') as HTMLElement | null;
    if (!linkEl) return;
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    const rawTarget = decodeURIComponent(linkEl.getAttribute('data-wikilink') || '').trim();
    if (!rawTarget) return;

    const match = store.cards.find(
      (c) => c.id === rawTarget || c.title.toLowerCase() === rawTarget.toLowerCase(),
    );
    if (!match) return;

    const rect = linkEl.getBoundingClientRect();
    const placeAbove = rect.bottom + 230 > window.innerHeight;
    const posX = Math.min(rect.left, window.innerWidth - 350);
    const posY = placeAbove ? rect.top - 8 : rect.bottom + 8;

    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      previewTargetCard = match;
      previewPosition = { x: Math.max(16, posX), y: posY, placeAbove };
      previewVisible = true;
    }, 200);
  }

  function handleWikilinkMouseLeave() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    closeTimer = window.setTimeout(() => {
      previewVisible = false;
    }, 200);
  }
</script>

<Dialog.Root open onOpenChange={(o) => !o && onclose()}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-40 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      onpaste={handlePaste}
      ondragover={(e) => e.preventDefault()}
      ondrop={handleFileDrop}
    >
      {#if coverUrl}
        <div class="relative h-44 sm:h-52 w-full shrink-0 overflow-hidden bg-slate-900 border-b border-slate-100 group">
          <img
            src={coverUrl}
            alt="Cover {title}"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          <div class="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/65 px-2.5 py-1 text-xs text-white/90 backdrop-blur-md border border-white/10 shadow-lg">
            <ImageIcon class="size-3.5 text-indigo-400" />
            <span>Cover Kartu</span>
          </div>
        </div>
      {/if}

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
          {#if activeCardTags.length > 0}
            <div class="mt-2 flex flex-wrap items-center gap-1.5 px-1">
              {#each activeCardTags as t (t)}
                {@const style = getTagColor(t)}
                <span class="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-medium border {style.bg} {style.text} {style.border}">
                  <span class="opacity-60">#</span>{t}
                </span>
              {/each}
            </div>
          {/if}
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
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => (templateModalOpen = true)}
                class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                title="Buka pilihan template catatan (Notula Rapat, Bug Report, dll)"
              >
                <LayoutTemplate class="size-3.5 text-indigo-600" />
                <span class="hidden sm:inline">Template</span>
              </button>

              <button
                type="button"
                onclick={() => fileInputEl?.click()}
                disabled={isUploadingImage}
                class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                title="Unggah berkas gambar atau tekan Ctrl + V untuk paste tangkapan layar"
              >
                {#if isUploadingImage}
                  <LoaderCircle class="size-3.5 animate-spin text-brand-600" />
                  <span>Mengunggah...</span>
                {:else}
                  <ImageIcon class="size-3.5 text-brand-600" />
                  <span class="hidden sm:inline">Sisipkan Gambar</span>
                {/if}
              </button>
              <input
                type="file"
                accept="image/*"
                bind:this={fileInputEl}
                onchange={handleFileInputChange}
                class="hidden"
              />

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
          </div>

          {#if mode === 'preview'}
            {#if !content.trim()}
              <!-- Empty State Template Selector -->
              <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
                <div class="mx-auto grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 mb-2.5">
                  <LayoutTemplate class="size-5" />
                </div>
                <h4 class="text-sm font-semibold text-slate-800">Catatan Masih Kosong</h4>
                <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Mulai menulis dokumen baru atau gunakan struktur template siap pakai berikut:
                </p>

                <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onclick={() => applyQuickTemplate('meeting-notes')}
                    class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:border-indigo-300 hover:text-indigo-600 transition cursor-pointer"
                  >
                    <Users class="size-3.5 text-indigo-500" />
                    <span>Notula Rapat</span>
                  </button>

                  <button
                    type="button"
                    onclick={() => applyQuickTemplate('bug-report')}
                    class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:border-indigo-300 hover:text-indigo-600 transition cursor-pointer"
                  >
                    <Bug class="size-3.5 text-rose-500" />
                    <span>Laporan Bug</span>
                  </button>

                  <button
                    type="button"
                    onclick={() => applyQuickTemplate('project-kickoff')}
                    class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:border-indigo-300 hover:text-indigo-600 transition cursor-pointer"
                  >
                    <Rocket class="size-3.5 text-amber-500" />
                    <span>Project Kickoff</span>
                  </button>

                  <button
                    type="button"
                    onclick={() => applyQuickTemplate('daily-standup')}
                    class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:border-indigo-300 hover:text-indigo-600 transition cursor-pointer"
                  >
                    <Sun class="size-3.5 text-amber-500" />
                    <span>Daily Standup</span>
                  </button>

                  <button
                    type="button"
                    onclick={() => (templateModalOpen = true)}
                    class="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <LayoutTemplate class="size-3.5" />
                    <span>Semua Template…</span>
                  </button>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-200/60">
                  <button
                    type="button"
                    onclick={() => (mode = 'edit')}
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-700 underline cursor-pointer"
                  >
                    Atau mulai menulis dokumen kosong &rarr;
                  </button>
                </div>
              </div>
            {:else}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_mouse_events_have_key_events -->
              <div
                class="markdown-body min-h-64 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300 cursor-text select-text"
                onclick={handleWikilinkClick}
                ondblclick={() => (mode = 'edit')}
                onmouseover={handleWikilinkMouseOver}
                onmouseleave={handleWikilinkMouseLeave}
                title="Klik dua kali untuk mengedit isi catatan"
              >
                {@html renderMarkdown(content)}
              </div>
              <div class="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Klik dua kali untuk mengedit</span>
                <span>Mendukung syntax Markdown &amp; wikilinks <code>[[Nama Catatan]]</code></span>
              </div>
            {/if}
          {:else}
            <div class="relative space-y-1.5">
              <!-- Bar Saran Tag Cepat -->
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <span class="text-slate-400 text-[11px] font-medium shrink-0 flex items-center gap-1">
                  <Tag class="size-3 text-slate-400" />
                  Saran tag:
                </span>
                {#each quickTags as qt (qt)}
                  {@const style = getTagColor(qt)}
                  <button
                    type="button"
                    class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium border transition cursor-pointer {style.bg} {style.text} {style.border} hover:opacity-80 shrink-0"
                    onclick={() => insertTag(qt)}
                    title={`Sisipkan #${qt}`}
                  >
                    <Plus class="size-2.5 opacity-60" />
                    <span class="opacity-60">#</span>{qt}
                  </button>
                {/each}
              </div>

              <textarea
                id="card-content"
                bind:this={textareaEl}
                class="input min-h-64 resize-y font-mono text-[13px] leading-relaxed"
                placeholder="Tulis catatan Markdown… Gunakan # Judul, - [ ] Checklist, atau [[Nama Kartu Lain]] untuk menghubungkan catatan."
                bind:value={content}
                onfocus={() => (focused = 'content')}
                onblur={blurContent}
                oninput={handleTextareaInput}
                onkeydown={handleTextareaKeyDown}
              ></textarea>

              <!-- Dropdown Saran Wikilink [[ (Obsidian Autocomplete) -->
              {#if showSuggest && (suggestCards.length > 0 || canCreateNew)}
                <div
                  bind:this={suggestContainerEl}
                  class="absolute left-2 right-2 bottom-12 z-30 max-h-56 overflow-y-auto rounded-xl border border-indigo-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in-0 duration-100"
                >
                  <div class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-100 mb-1">
                    <span class="flex items-center gap-1.5 text-indigo-600">
                      <span>Tautkan Catatan [[</span>
                      {#if suggestQuery}
                        <span class="font-mono text-slate-700 bg-slate-100 px-1 rounded lowercase">{suggestQuery}</span>
                      {/if}
                    </span>
                    <span class="font-normal lowercase text-slate-400">&uarr;&darr; navigasi &bull; Enter pilih</span>
                  </div>

                  {#each suggestCards as item, idx (item.id)}
                    {@const isActive = suggestIndex === idx}
                    <button
                      type="button"
                      data-active={isActive}
                      onmousedown={(e) => {
                        e.preventDefault();
                        applySuggestion(item.title);
                      }}
                      onmouseenter={() => (suggestIndex = idx)}
                      class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition cursor-pointer {isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-800 hover:bg-slate-100'}"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <FileText class="size-3.5 shrink-0 {isActive ? 'text-indigo-200' : 'text-slate-400'}" />
                        <span class="font-medium truncate">[[{item.title}]]</span>
                      </div>
                      <span
                        class="rounded px-1.5 py-0.5 text-[10px] shrink-0 font-medium {isActive
                          ? 'bg-indigo-700 text-white'
                          : 'bg-slate-100 text-slate-500'}"
                      >
                        {store.lists.find((l) => l.id === item.list_id)?.title ?? 'List'}
                      </span>
                    </button>
                  {/each}

                  {#if canCreateNew}
                    {@const isNewActive = suggestIndex === suggestCards.length}
                    <button
                      type="button"
                      data-active={isNewActive}
                      onmousedown={(e) => {
                        e.preventDefault();
                        applySuggestion(suggestQuery.trim());
                      }}
                      onmouseenter={() => (suggestIndex = suggestCards.length)}
                      class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition cursor-pointer mt-0.5 border-t border-slate-100 {isNewActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100'}"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <Plus class="size-3.5 shrink-0 {isNewActive ? 'text-white' : 'text-indigo-600'}" />
                        <span class="truncate">Buat tautan baru: <strong>[[{suggestQuery.trim()}]]</strong></span>
                      </div>
                      <span class="text-[10px] opacity-75 shrink-0">Enter &crarr;</span>
                    </button>
                  {/if}
                </div>
              {/if}

              <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>Tips: Ketik <code>[[</code> untuk saran tautan, atau tekan <code>Ctrl + V</code> untuk tempel gambar screenshot.</span>
                <button type="button" class="text-brand-600 font-medium underline cursor-pointer" onclick={() => (mode = 'preview')}>
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
                currentContent={content}
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

          <!-- Panel Graf Lokal (Obsidian Local Graph) -->
          <LocalGraphPanel
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

<!-- Popover Pratinjau Mengambang Tautan (Obsidian Hover Preview) -->
<WikilinkPreviewPopover
  targetCard={previewTargetCard}
  {store}
  position={previewPosition}
  visible={previewVisible}
  onopen={(targetId) => {
    previewVisible = false;
    router.go(`/board/${store.board?.id}/card/${targetId}`);
  }}
  onmouseenter={() => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }}
  onmouseleave={handleWikilinkMouseLeave}
/>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Hapus kartu?"
  description={`Kartu "${card.title}" akan dihapus dari papan. Salinan tetap tersimpan di database internal.`}
  onconfirm={async () => {
    onclose();
    await store.updateCard(card.id, { deleted_at: new Date().toISOString() });
  }}
/>

<TemplatePickerModal
  bind:open={templateModalOpen}
  currentContent={content}
  currentTitle={title}
  onapply={handleTemplateApplied}
/>
