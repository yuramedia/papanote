<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Folder from '@lucide/svelte/icons/folder';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import FileText from '@lucide/svelte/icons/file-text';
  import FilePlus from '@lucide/svelte/icons/file-plus';
  import Search from '@lucide/svelte/icons/search';
  import Network from '@lucide/svelte/icons/network';
  import Layers from '@lucide/svelte/icons/layers';
  import Kanban from '@lucide/svelte/icons/kanban';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import Eye from '@lucide/svelte/icons/eye';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import X from '@lucide/svelte/icons/x';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
  import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
  import Check from '@lucide/svelte/icons/check';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Database from '@lucide/svelte/icons/database';
  import Settings from '@lucide/svelte/icons/settings';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Tag from '@lucide/svelte/icons/tag';
  import Terminal from '@lucide/svelte/icons/terminal';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';
  import { renderMarkdown } from '../lib/markdown';
  import { uploadAttachment, insertImageMarkdown } from '../lib/attachments';
  import { extractTags, getTagColor } from '../lib/tags';
  import { toast } from '../lib/toast.svelte';

  let {
    store,
    onopen,
    onSwitchView,
  }: {
    store: BoardStore;
    onopen: (id: string) => void;
    onSwitchView: (view: 'kanban' | 'graph' | 'canvas' | 'notes' | 'calendar') => void;
  } = $props();

  // Sidebar collapse toggle
  let sidebarOpen = $state(true);

  // Folder collapse state (listId -> boolean)
  let collapsedFolders = $state<Record<string, boolean>>({});

  // Tags section collapse state
  let tagsSectionCollapsed = $state(false);

  // Active Card ID di editor dokumen
  let activeCardId = $state<string | null>(null);

  // History navigasi catatan (untuk tombol Back/Forward)
  let historyStack = $state<string[]>([]);
  let historyIndex = $state(-1);

  // Draft lokal editor
  let activeTitle = $state('');
  let activeContent = $state('');
  let editorMode = $state<'preview' | 'edit'>('edit');
  let saveStatus = $state<'saved' | 'saving' | 'idle'>('saved');

  // Lampiran Gambar
  let isUploadingImage = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  // Input buat catatan baru di sidebar
  let creatingInListId = $state<string | null>(null);
  let newCardTitle = $state('');

  // Autocomplete Wikilinks [[
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let suggestContainerEl = $state<HTMLDivElement | null>(null);
  let showSuggest = $state(false);
  let suggestQuery = $state('');
  let suggestIndex = $state(0);
  let suggestStartPos = $state(0);

  // Temukan kartu aktif dari store
  const activeCard = $derived.by<Card | undefined>(() => {
    if (!activeCardId) return undefined;
    return store.findCard(activeCardId);
  });

  // Sinkronkan draft saat kartu aktif berganti
  $effect(() => {
    if (activeCard) {
      activeTitle = activeCard.title;
      activeContent = activeCard.content ?? '';
    } else {
      activeTitle = '';
      activeContent = '';
    }
  });

  // Pilih kartu pertama secara default jika belum ada kartu yang dipilih
  $effect(() => {
    if (!activeCardId && store.cards.length > 0) {
      const firstActive = store.cards.find((c) => !c.deleted_at);
      if (firstActive) {
        selectCard(firstActive.id, false);
      }
    }
  });

  function selectCard(cardId: string, addToHistory = true) {
    if (activeCardId === cardId) return;
    activeCardId = cardId;

    if (addToHistory) {
      if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
      }
      historyStack.push(cardId);
      historyIndex = historyStack.length - 1;
    }
  }

  function goBack() {
    if (historyIndex > 0) {
      historyIndex--;
      activeCardId = historyStack[historyIndex];
    }
  }

  function goForward() {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      activeCardId = historyStack[historyIndex];
    }
  }

  function toggleFolder(listId: string) {
    collapsedFolders[listId] = !collapsedFolders[listId];
  }

  // Autosave
  let saveTimer: number | null = null;
  function triggerAutoSave() {
    if (!activeCard) return;
    saveStatus = 'saving';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      if (!activeCard) return;
      const ok = await store.updateCard(activeCard.id, {
        title: activeTitle.trim() || activeCard.title,
        content: activeContent,
      });
      saveStatus = ok ? 'saved' : 'idle';
    }, 400);
  }

  async function processImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Berkas harus berupa gambar.');
      return;
    }
    if (!activeCardId) {
      toast.error('Pilih atau buat catatan terlebih dahulu.');
      return;
    }
    isUploadingImage = true;
    try {
      toast.info('Menyiapkan gambar...');
      const { url, name } = await uploadAttachment(file, `board_${store.board?.id || 'main'}/card_${activeCardId}`);
      const cursorPos = textareaEl ? textareaEl.selectionStart : undefined;
      const { newContent, newCursor } = insertImageMarkdown(activeContent, url, name, cursorPos);
      activeContent = newContent;
      triggerAutoSave();
      toast.success('Gambar berhasil disisipkan!');

      if (editorMode === 'edit' && textareaEl) {
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

  // Pembuatan Catatan Baru
  async function handleCreateCard(listId: string) {
    const title = newCardTitle.trim();
    if (!title) {
      creatingInListId = null;
      return;
    }
    const created = await store.addCard(listId, title);
    newCardTitle = '';
    creatingInListId = null;
    if (created) {
      selectCard(created.id);
      editorMode = 'edit';
      await tick();
      textareaEl?.focus();
    }
  }

  async function createQuickNote() {
    const targetList = store.sortedLists[0];
    if (!targetList) {
      toast.error('Buat list terlebih dahulu.');
      return;
    }
    const created = await store.addCard(targetList.id, 'Untitled Note');
    if (created) {
      selectCard(created.id);
      editorMode = 'edit';
      await tick();
      textareaEl?.focus();
    }
  }

  // Autocomplete Wikilinks [[
  const suggestCards = $derived.by<Card[]>(() => {
    if (!showSuggest) return [];
    const q = suggestQuery.trim().toLowerCase();
    const others = store.cards.filter((c) => !c.deleted_at && c.id !== activeCardId);
    if (!q) return others.slice(0, 8);
    return others.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 8);
  });

  const canCreateNew = $derived.by<boolean>(() => {
    if (!showSuggest) return false;
    const q = suggestQuery.trim();
    if (!q) return false;
    return !store.cards.some((c) => !c.deleted_at && c.title.toLowerCase() === q.toLowerCase());
  });

  function handleTextareaInput() {
    triggerAutoSave();
    if (!textareaEl) return;
    const cursorPos = textareaEl.selectionStart;
    const textBeforeCursor = activeContent.slice(0, cursorPos);
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
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      suggestIndex = (suggestIndex - 1 + totalOptions) % totalOptions;
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
    const before = activeContent.slice(0, suggestStartPos);
    const after = activeContent.slice(cursorPos);
    const hasClosing = after.startsWith(']]');
    const cleanAfter = hasClosing ? after.slice(2) : after;
    const inserted = `[[${chosenTitle}]] `;
    activeContent = before + inserted + cleanAfter;
    showSuggest = false;
    triggerAutoSave();

    const newCursor = suggestStartPos + inserted.length;
    setTimeout(() => {
      textareaEl?.focus();
      textareaEl?.setSelectionRange(newCursor, newCursor);
    }, 10);
  }

  // Sistem Tagar Catatan
  const currentCardTags = $derived(extractTags(activeContent));
  const quickTags = $derived.by<string[]>(() => {
    const list = store.allTags.map((t) => t.tag);
    const defaults = ['urgent', 'p1', 'wip', 'done', 'idea', 'review'];
    const merged = Array.from(new Set([...list, ...defaults]));
    return merged.slice(0, 8);
  });

  function insertTagInDoc(tagName: string) {
    const tagText = `#${tagName} `;
    if (!textareaEl) {
      activeContent = activeContent ? `${activeContent} ${tagText}` : tagText;
      triggerAutoSave();
      return;
    }
    const start = textareaEl.selectionStart ?? activeContent.length;
    const end = textareaEl.selectionEnd ?? activeContent.length;
    const before = activeContent.slice(0, start);
    const after = activeContent.slice(end);
    const needLeadingSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    activeContent = before + (needLeadingSpace ? ' ' : '') + tagText + after;
    triggerAutoSave();
    setTimeout(() => {
      textareaEl?.focus();
      const pos = start + tagText.length + (needLeadingSpace ? 1 : 0);
      textareaEl?.setSelectionRange(pos, pos);
    }, 10);
  }

  // Klik wikilink & tag di mode preview
  function handlePreviewWikilinkClick(e: MouseEvent) {
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
    const rawTarget = decodeURIComponent(target.getAttribute('data-wikilink') || '').trim();
    if (!rawTarget) return;

    const match = store.cards.find(
      (c) => !c.deleted_at && (c.id === rawTarget || c.title.toLowerCase() === rawTarget.toLowerCase()),
    );
    if (match) {
      selectCard(match.id);
    } else {
      toast.error(`Catatan "${rawTarget}" belum dibuat.`);
    }
  }

  // Statistik Catatan (Status bar)
  const stats = $derived.by(() => {
    const text = activeContent.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;

    // Backlinks: Berapa banyak kartu yang menautkan kartu ini
    let backlinks = 0;
    if (activeCard) {
      const titleLower = activeCard.title.toLowerCase();
      const idStr = activeCard.id;
      store.cards.forEach((c) => {
        if (c.id !== activeCard.id && !c.deleted_at && c.content) {
          if (c.content.toLowerCase().includes(`[[${titleLower}`) || c.content.includes(`[[${idStr}`)) {
            backlinks++;
          }
        }
      });
    }

    return { words, chars, backlinks };
  });
</script>

<div class="flex h-full w-full overflow-hidden bg-[#1e1e1e] text-slate-200 select-none font-sans">
  <!-- 1. LEFT RIBBON (Bilah Ikon Vertikal Terluar khas Obsidian) -->
  <aside class="flex w-11 shrink-0 flex-col items-center justify-between border-r border-[#2a2a2a] bg-[#141414] py-3 text-slate-400">
    <div class="flex flex-col items-center gap-3">
      <!-- Toggle File Explorer -->
      <button
        type="button"
        class="rounded p-1.5 transition hover:bg-[#2a2a2a] hover:text-white cursor-pointer {sidebarOpen ? 'text-indigo-400 bg-[#252525]' : 'text-slate-400'}"
        onclick={() => (sidebarOpen = !sidebarOpen)}
        title="Buka/Tutup Sidebar Catatan"
      >
        <Folder class="size-4" />
      </button>

      <!-- New Quick Note -->
      <button
        type="button"
        class="rounded p-1.5 transition hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
        onclick={createQuickNote}
        title="Buat Catatan Baru"
      >
        <FilePlus class="size-4 text-emerald-400" />
      </button>

      <div class="h-px w-5 bg-[#2a2a2a]"></div>

      <!-- Quick Switcher -->
      <button
        type="button"
        class="rounded p-1.5 transition hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
        onclick={() => (window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true })))}
        title="Pencarian Cepat Catatan (Ctrl+O)"
      >
        <Search class="size-4" />
      </button>

      <!-- Command Palette -->
      <button
        type="button"
        class="rounded p-1.5 transition hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
        onclick={() => (window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true })))}
        title="Command Palette (Ctrl+P)"
      >
        <Terminal class="size-4 text-indigo-400" />
      </button>

      <!-- Switch to Graph View -->
      <button
        type="button"
        class="rounded p-1.5 transition hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
        onclick={() => onSwitchView('graph')}
        title="Tampilan Graph Obsidian"
      >
        <Network class="size-4" />
      </button>

      <!-- Switch to Canvas View -->
      <button
        type="button"
        class="rounded p-1.5 transition hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
        onclick={() => onSwitchView('canvas')}
        title="Tampilan Canvas Obsidian"
      >
        <Layers class="size-4" />
      </button>

      <!-- Switch to Kanban View -->
      <button
        type="button"
        class="rounded p-1.5 transition hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
        onclick={() => onSwitchView('kanban')}
        title="Tampilan Kanban Papan"
      >
        <Kanban class="size-4" />
      </button>

      <!-- Switch to Calendar View -->
      <button
        type="button"
        class="rounded p-1.5 transition hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
        onclick={() => onSwitchView('calendar')}
        title="Tampilan Kalender & Timeline"
      >
        <CalendarIcon class="size-4" />
      </button>
    </div>

    <!-- Bottom Ribbon Tools -->
    <div class="flex flex-col items-center gap-2">
      <button
        type="button"
        class="rounded p-1.5 text-slate-500 hover:bg-[#2a2a2a] hover:text-slate-300 transition cursor-pointer"
        title="Vault / Pengaturan"
      >
        <Settings class="size-4" />
      </button>
    </div>
  </aside>

  <!-- 2. LEFT SIDEBAR (File Tree Explorer khas Obsidian) -->
  {#if sidebarOpen}
    <nav class="flex w-56 sm:w-64 shrink-0 flex-col border-r border-[#2a2a2a] bg-[#181818] text-xs">
      <!-- Header Sidebar -->
      <div class="flex h-10 items-center justify-between border-b border-[#252525] px-3 font-semibold text-slate-400">
        <span class="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-slate-400">
          <Database class="size-3.5 text-indigo-400" />
          <span>Files</span>
        </span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded p-1 text-slate-400 hover:bg-[#262626] hover:text-white transition cursor-pointer"
            onclick={createQuickNote}
            title="Catatan Baru"
          >
            <FilePlus class="size-3.5" />
          </button>
          <button
            type="button"
            class="rounded p-1 text-slate-400 hover:bg-[#262626] hover:text-white transition cursor-pointer"
            onclick={() => (sidebarOpen = false)}
            title="Sembunyikan Sidebar"
          >
            <PanelLeftClose class="size-3.5" />
          </button>
        </div>
      </div>

      <!-- File & Folder Tree -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        {#each store.sortedLists as list (list.id)}
          {@const isCollapsed = collapsedFolders[list.id]}
          {@const cardsInList = store.cards.filter((c) => !c.deleted_at && c.list_id === list.id)}

          <div class="rounded-md">
            <!-- Folder Header (List) -->
            <div
              class="group flex items-center justify-between rounded-md px-1.5 py-1 text-slate-300 hover:bg-[#252525] transition cursor-pointer"
              onclick={() => toggleFolder(list.id)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && toggleFolder(list.id)}
            >
              <div class="flex items-center gap-1.5 truncate">
                <span class="text-slate-500">
                  {#if isCollapsed}
                    <ChevronRight class="size-3.5" />
                  {:else}
                    <ChevronDown class="size-3.5" />
                  {/if}
                </span>
                <span class="truncate font-medium text-slate-300">{list.title}</span>
                <span class="text-[10px] text-slate-500 font-normal">({cardsInList.length})</span>
              </div>
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-white hover:bg-[#333333] transition cursor-pointer"
                onclick={(e) => {
                  e.stopPropagation();
                  creatingInListId = list.id;
                  collapsedFolders[list.id] = false;
                }}
                title="Tambah catatan di list ini"
              >
                <Plus class="size-3" />
              </button>
            </div>

            <!-- Input Inline Buat Catatan Baru di List -->
            {#if creatingInListId === list.id}
              <form
                onsubmit={(e) => {
                  e.preventDefault();
                  handleCreateCard(list.id);
                }}
                class="ml-5 mt-1 mr-1 flex items-center gap-1"
              >
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  type="text"
                  placeholder="Nama catatan…"
                  bind:value={newCardTitle}
                  class="w-full rounded bg-[#252525] border border-indigo-500/60 px-2 py-0.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  autofocus
                  onblur={() => handleCreateCard(list.id)}
                />
              </form>
            {/if}

            <!-- File Item di Dalam Folder -->
            {#if !isCollapsed}
              <div class="ml-3 pl-2 border-l border-[#2a2a2a] mt-0.5 space-y-0.5">
                {#each cardsInList as card (card.id)}
                  {@const isActive = activeCardId === card.id}
                  {@const cardTags = extractTags(card.content)}
                  {@const matchesTag = store.activeTags.length === 0 || store.activeTags.every((t) => cardTags.includes(t))}
                  {#if matchesTag}
                    <button
                      type="button"
                      class="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs transition cursor-pointer {isActive
                        ? 'bg-[#2c2c2c] text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:bg-[#222222] hover:text-slate-200'}"
                      onclick={() => selectCard(card.id)}
                    >
                      <div class="flex items-center gap-2 truncate">
                        <FileText class="size-3.5 shrink-0 {isActive ? 'text-indigo-400' : 'text-slate-500'}" />
                        <span class="truncate">{card.title}</span>
                      </div>
                      {#if cardTags.length > 0}
                        <div class="flex items-center gap-1 shrink-0 ml-1">
                          {#each cardTags.slice(0, 1) as t (t)}
                            {@const style = getTagColor(t)}
                            <span class="size-1.5 rounded-full" style="background-color: {style.dotHex}" title={`#${t}`}></span>
                          {/each}
                        </div>
                      {/if}
                    </button>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Tags Section (Tag Explorer ala Obsidian) -->
      {#if store.allTags.length > 0}
        <div class="border-t border-[#252525] p-2 shrink-0">
          <div
            class="flex items-center justify-between px-1.5 py-1 text-slate-400 hover:text-slate-200 transition cursor-pointer select-none"
            onclick={() => (tagsSectionCollapsed = !tagsSectionCollapsed)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && (tagsSectionCollapsed = !tagsSectionCollapsed)}
          >
            <span class="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-semibold">
              <Tag class="size-3 text-indigo-400" />
              <span>Tags</span>
              <span class="text-slate-500 font-normal">({store.allTags.length})</span>
            </span>
            <span class="text-slate-500">
              {#if tagsSectionCollapsed}
                <ChevronRight class="size-3.5" />
              {:else}
                <ChevronDown class="size-3.5" />
              {/if}
            </span>
          </div>

          {#if !tagsSectionCollapsed}
            <div class="mt-1 space-y-0.5 max-h-44 overflow-y-auto no-scrollbar">
              {#each store.allTags as { tag, count } (tag)}
                {@const isSelected = store.activeTags.includes(tag)}
                {@const style = getTagColor(tag)}
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs transition cursor-pointer {isSelected
                    ? 'bg-indigo-600/30 text-indigo-200 font-medium'
                    : 'text-slate-400 hover:bg-[#252525] hover:text-slate-200'}"
                  onclick={() => store.toggleTag(tag)}
                  title={`Filter #${tag} (${count} catatan)`}
                >
                  <span class="flex items-center gap-1.5 truncate">
                    <span class="size-1.5 rounded-full shrink-0" style="background-color: {style.dotHex}"></span>
                    <span class="truncate">#{tag}</span>
                  </span>
                  <span class="text-[10px] rounded px-1.5 py-0.2 {isSelected ? 'bg-indigo-500/40 text-indigo-100' : 'bg-[#222222] text-slate-500'}">
                    {count}
                  </span>
                </button>
              {/each}
              {#if store.activeTags.length > 0}
                <button
                  type="button"
                  class="mt-1 w-full text-center text-[10px] text-indigo-300 hover:text-indigo-200 py-0.5 cursor-pointer underline"
                  onclick={() => store.clearTags()}
                >
                  Reset Filter Tag ({store.activeTags.length})
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Footer Sidebar: Vault Name -->
      <div class="flex h-9 items-center justify-between border-t border-[#252525] px-3 text-[11px] text-slate-400">
        <span class="flex items-center gap-1.5 truncate">
          <Database class="size-3 text-slate-500 shrink-0" />
          <span class="truncate font-medium">{store.board?.title || 'Obsidian Vault'}</span>
        </span>
      </div>
    </nav>
  {/if}

  <!-- 3. MAIN EDITOR PANE (Tengah: Obsidian Distraction-Free Workspace) -->
  <main class="flex flex-1 flex-col overflow-hidden bg-[#1e1e1e]">
    <!-- Top Tab Bar (Navigasi Tab Catatan khas Obsidian) -->
    <header class="flex h-10 shrink-0 items-center justify-between border-b border-[#2a2a2a] bg-[#181818] px-2 text-xs">
      <div class="flex items-center gap-1 min-w-0">
        {#if !sidebarOpen}
          <button
            type="button"
            class="rounded p-1 text-slate-400 hover:bg-[#2a2a2a] hover:text-white transition cursor-pointer mr-1"
            onclick={() => (sidebarOpen = true)}
            title="Buka Sidebar Catatan"
          >
            <PanelLeftOpen class="size-4" />
          </button>
        {/if}

        <!-- Back & Forward History Buttons -->
        <div class="flex items-center gap-0.5 mr-2 text-slate-400">
          <button
            type="button"
            class="rounded p-1 hover:bg-[#2a2a2a] hover:text-white transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            onclick={goBack}
            disabled={historyIndex <= 0}
            title="Kembali"
          >
            <ArrowLeft class="size-3.5" />
          </button>
          <button
            type="button"
            class="rounded p-1 hover:bg-[#2a2a2a] hover:text-white transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            onclick={goForward}
            disabled={historyIndex >= historyStack.length - 1}
            title="Maju"
          >
            <ArrowRight class="size-3.5" />
          </button>
        </div>

        <!-- Tab Aktif -->
        {#if activeCard}
          <div class="flex items-center gap-2 rounded-t-lg bg-[#1e1e1e] border-t border-x border-[#2a2a2a] px-3 py-1.5 text-white font-medium max-w-xs truncate shadow-sm">
            <FileText class="size-3.5 text-indigo-400 shrink-0" />
            <span class="truncate">{activeTitle || activeCard.title}</span>
          </div>
        {/if}

        <!-- Tambah Catatan Baru Tab (+) -->
        <button
          type="button"
          class="rounded p-1 text-slate-400 hover:bg-[#2a2a2a] hover:text-white transition cursor-pointer ml-1"
          onclick={createQuickNote}
          title="Buka Catatan Baru"
        >
          <Plus class="size-3.5" />
        </button>
      </div>

      <!-- Controls Kanan Header: Mode Toggle & Buka Modal -->
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          onclick={() => fileInputEl?.click()}
          disabled={isUploadingImage || !activeCardId}
          class="flex items-center gap-1 rounded-md bg-[#252525] hover:bg-[#303030] px-2 py-1 text-[11px] font-medium text-slate-300 transition cursor-pointer disabled:opacity-40"
          title="Unggah berkas gambar atau tekan Ctrl + V untuk paste tangkapan layar"
        >
          {#if isUploadingImage}
            <LoaderCircle class="size-3 animate-spin text-indigo-400" />
            <span class="hidden sm:inline">Mengunggah...</span>
          {:else}
            <ImageIcon class="size-3 text-indigo-400" />
            <span class="hidden sm:inline">Gambar</span>
          {/if}
        </button>
        <input
          type="file"
          accept="image/*"
          bind:this={fileInputEl}
          onchange={handleFileInputChange}
          class="hidden"
        />

        <div class="flex items-center rounded-lg bg-[#252525] p-0.5 text-[11px]">
          <button
            type="button"
            class="flex items-center gap-1 rounded-md px-2 py-1 font-medium transition cursor-pointer {editorMode === 'preview'
              ? 'bg-[#333333] text-white shadow-sm'
              : 'text-slate-400 hover:text-white'}"
            onclick={() => (editorMode = 'preview')}
            title="Mode Baca / Preview Markdown"
          >
            <Eye class="size-3" />
            <span class="hidden sm:inline">Preview</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1 rounded-md px-2 py-1 font-medium transition cursor-pointer {editorMode === 'edit'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'}"
            onclick={() => (editorMode = 'edit')}
            title="Mode Tulis / Edit Markdown"
          >
            <Pencil class="size-3" />
            <span class="hidden sm:inline">Edit</span>
          </button>
        </div>

        {#if activeCard}
          <button
            type="button"
            class="rounded p-1.5 text-slate-400 hover:bg-[#2a2a2a] hover:text-white transition cursor-pointer"
            onclick={() => onopen(activeCard.id)}
            title="Buka detail lengkap kartu"
          >
            <ExternalLink class="size-3.5" />
          </button>
        {/if}
      </div>
    </header>

    <!-- Editor Body (Distraction-Free Workspace) -->
    <div
      role="region"
      aria-label="Editor Catatan"
      class="relative flex-1 overflow-y-auto p-6 sm:p-12"
      ondragover={(e) => e.preventDefault()}
      ondrop={handleFileDrop}
    >
      {#if activeCard}
        <div class="mx-auto max-w-3xl">
          <!-- Judul Catatan Besar (Title) -->
          <input
            type="text"
            bind:value={activeTitle}
            oninput={triggerAutoSave}
            placeholder="Judul Catatan…"
            class="w-full bg-transparent text-3xl sm:text-4xl font-bold tracking-tight text-white placeholder:text-slate-600 border-none outline-none mb-3"
          />

          {#if currentCardTags.length > 0}
            <div class="mb-5 flex flex-wrap items-center gap-1.5">
              {#each currentCardTags as t (t)}
                {@const style = getTagColor(t)}
                <span class="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-medium border {style.bg} {style.text} {style.border} shadow-2xs">
                  <span class="opacity-60">#</span>{t}
                </span>
              {/each}
            </div>
          {/if}

          {#if editorMode === 'edit'}
            <!-- Bar Saran Tag Cepat -->
            <div class="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span class="text-slate-500 text-[11px] font-medium shrink-0 flex items-center gap-1">
                <Tag class="size-3 text-slate-500" />
                Saran tag:
              </span>
              {#each quickTags as qt (qt)}
                {@const style = getTagColor(qt)}
                <button
                  type="button"
                  class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium border transition cursor-pointer {style.bg} {style.text} {style.border} hover:opacity-80 shrink-0"
                  onclick={() => insertTagInDoc(qt)}
                  title={`Sisipkan #${qt}`}
                >
                  <Plus class="size-2.5 opacity-60" />
                  <span class="opacity-60">#</span>{qt}
                </button>
              {/each}
            </div>

            <!-- Mode Edit: Seamless Textarea -->
            <div class="relative">
              <textarea
                bind:this={textareaEl}
                bind:value={activeContent}
                oninput={handleTextareaInput}
                onkeydown={handleTextareaKeyDown}
                onpaste={handlePaste}
                placeholder="Mulai menulis catatan… Gunakan # Judul, - [ ] Checklist, atau [[Nama Catatan Lain]] untuk menautkan catatan ala Obsidian. Tekan Ctrl+V untuk tempel gambar."
                class="w-full min-h-[500px] resize-none bg-transparent font-mono text-[14px] leading-relaxed text-slate-200 placeholder:text-slate-600 border-none outline-none focus:ring-0 selection:bg-indigo-600/40"
              ></textarea>

              <!-- Autocomplete Suggester [[ di dalam Notes Doc View -->
              {#if showSuggest && (suggestCards.length > 0 || canCreateNew)}
                <div
                  bind:this={suggestContainerEl}
                  class="absolute left-0 right-0 bottom-8 z-30 max-h-56 overflow-y-auto rounded-xl border border-indigo-500/40 bg-[#252525] p-1.5 shadow-2xl backdrop-blur-md text-xs"
                >
                  <div class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-[#333333] mb-1">
                    <span class="flex items-center gap-1.5 text-indigo-400">
                      <span>Tautkan Catatan [[</span>
                      {#if suggestQuery}
                        <span class="font-mono text-white bg-[#1a1a1a] px-1 rounded lowercase">{suggestQuery}</span>
                      {/if}
                    </span>
                    <span class="font-normal lowercase text-slate-500">&uarr;&darr; navigasi &bull; Enter pilih</span>
                  </div>

                  {#each suggestCards as item, idx (item.id)}
                    {@const isActive = suggestIndex === idx}
                    <button
                      type="button"
                      onmousedown={(e) => {
                        e.preventDefault();
                        applySuggestion(item.title);
                      }}
                      onmouseenter={() => (suggestIndex = idx)}
                      class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition cursor-pointer {isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-200 hover:bg-[#333333]'}"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <FileText class="size-3.5 shrink-0 {isActive ? 'text-white' : 'text-slate-400'}" />
                        <span class="font-medium truncate">[[{item.title}]]</span>
                      </div>
                      <span class="text-[10px] text-slate-400 shrink-0">
                        {store.lists.find((l) => l.id === item.list_id)?.title ?? 'List'}
                      </span>
                    </button>
                  {/each}

                  {#if canCreateNew}
                    {@const isNewActive = suggestIndex === suggestCards.length}
                    <button
                      type="button"
                      onmousedown={(e) => {
                        e.preventDefault();
                        applySuggestion(suggestQuery.trim());
                      }}
                      onmouseenter={() => (suggestIndex = suggestCards.length)}
                      class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition cursor-pointer mt-0.5 border-t border-[#333333] {isNewActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-[#333333]'}"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <Plus class="size-3.5 shrink-0 {isNewActive ? 'text-white' : 'text-indigo-400'}" />
                        <span class="truncate">Buat tautan baru: <strong>[[{suggestQuery.trim()}]]</strong></span>
                      </div>
                      <span class="text-[10px] opacity-75 shrink-0">Enter &crarr;</span>
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          {:else}
            <!-- Mode Preview: Live Render Markdown -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="markdown-body dark-markdown min-h-[400px] text-slate-200 leading-relaxed cursor-text selection:bg-indigo-600/40"
              onclick={handlePreviewWikilinkClick}
              ondblclick={() => (editorMode = 'edit')}
              title="Klik dua kali untuk mulai mengedit catatan"
            >
              {@html renderMarkdown(activeContent)}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Tampilan Kosong (Welcome / Empty State) persis screenshot Obsidian -->
        <div class="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
          <div class="rounded-2xl bg-[#262626] p-4 text-indigo-400 shadow-xl mb-4">
            <FileText class="size-8" />
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Welcome to your Notes Vault</h2>
          <p class="text-sm text-slate-400 leading-relaxed mb-6">
            Pilih catatan dari sidebar kiri atau buat catatan baru untuk mulai menulis ide dan menghubungkannya dengan tautan [[wikilinks]].
          </p>
          <button
            type="button"
            class="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            onclick={createQuickNote}
          >
            <FilePlus class="size-4" />
            <span>Buat Catatan Baru</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- 4. BOTTOM STATUS BAR (Statistik Catatan khas Obsidian) -->
    <footer class="flex h-7 shrink-0 items-center justify-between border-t border-[#2a2a2a] bg-[#141414] px-3 text-[11px] text-slate-400 select-none">
      <div class="flex items-center gap-2">
        <span class="flex items-center gap-1.5">
          {#if saveStatus === 'saving'}
            <LoaderCircle class="size-3 animate-spin text-amber-400" />
            <span class="text-amber-400">Menyimpan…</span>
          {:else}
            <Check class="size-3 text-emerald-400" />
            <span class="text-slate-400">Tersimpan</span>
          {/if}
        </span>
        {#if activeCard}
          <span class="text-slate-600">&bull;</span>
          <span class="text-slate-400 truncate max-w-[150px]">
            {store.lists.find((l) => l.id === activeCard.list_id)?.title ?? 'List'}
          </span>
        {/if}
      </div>

      <div class="flex items-center gap-3 text-slate-400">
        {#if currentCardTags.length > 0}
          <span class="flex items-center gap-1 text-indigo-300">
            <Tag class="size-2.5" />
            <span>{currentCardTags.length} tags</span>
          </span>
          <span class="text-slate-600">&bull;</span>
        {/if}
        <span>{stats.backlinks} backlinks</span>
        <span class="text-slate-600">&bull;</span>
        <span>{stats.words} kata</span>
        <span class="text-slate-600">&bull;</span>
        <span>{stats.chars} karakter</span>
      </div>
    </footer>
  </main>
</div>
