<script lang="ts">
  import { Dialog } from 'bits-ui';
  import LayoutTemplate from '@lucide/svelte/icons/layout-template';
  import Search from '@lucide/svelte/icons/search';
  import X from '@lucide/svelte/icons/x';
  import Users from '@lucide/svelte/icons/users';
  import Bug from '@lucide/svelte/icons/bug';
  import Rocket from '@lucide/svelte/icons/rocket';
  import Sun from '@lucide/svelte/icons/sun';
  import ClipboardList from '@lucide/svelte/icons/clipboard-list';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import FileText from '@lucide/svelte/icons/file-text';
  import Check from '@lucide/svelte/icons/check';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
  import {
    getAllTemplates,
    applyTemplate,
    saveUserTemplate,
    deleteUserTemplate,
    type NoteTemplate,
  } from '../lib/templates';
  import { getTagColor } from '../lib/tags';
  import { renderMarkdown } from '../lib/markdown';
  import { toast } from '../lib/toast.svelte';

  let {
    open = $bindable(false),
    currentContent = '',
    currentTitle = '',
    onapply,
  }: {
    open?: boolean;
    currentContent?: string;
    currentTitle?: string;
    onapply: (res: { title: string; content: string; template: NoteTemplate }) => void;
  } = $props();

  let searchQuery = $state('');
  let selectedCategory = $state<string>('all');
  let selectedTemplateId = $state<string>('meeting-notes');
  let showCreateCustom = $state(false);

  // Form template kustom baru
  let customName = $state('');
  let customTitlePattern = $state('');
  let customDescription = $state('');
  let customCategory = $state<'Produktivitas' | 'Teknis' | 'Proyek' | 'Umum'>('Umum');
  let customContent = $state('');

  // Mode append jika catatan saat ini tidak kosong
  let appendMode = $state(false);

  // Refresh trigger untuk localStorage
  let refreshCount = $state(0);

  // Ambil semua template
  const allTemplates = $derived.by<NoteTemplate[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    refreshCount;
    return getAllTemplates();
  });

  // Filter template berdasarkan pencarian dan kategori
  const filteredTemplates = $derived.by<NoteTemplate[]>(() => {
    let list = allTemplates;
    const q = searchQuery.trim().toLowerCase();

    if (selectedCategory === 'custom') {
      list = list.filter((t) => t.isCustom);
    } else if (selectedCategory !== 'all') {
      list = list.filter((t) => t.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (q) {
      list = list.filter((t) => {
        const nameMatch = t.name.toLowerCase().includes(q);
        const descMatch = t.description.toLowerCase().includes(q);
        const tagMatch = t.tags.some((tag) => tag.toLowerCase().includes(q));
        return nameMatch || descMatch || tagMatch;
      });
    }

    return list;
  });

  // Template yang sedang dipilih untuk preview
  const activeTemplate = $derived.by<NoteTemplate | undefined>(() => {
    const found = allTemplates.find((t) => t.id === selectedTemplateId);
    return found || filteredTemplates[0] || allTemplates[0];
  });

  // Preview teks hasil render
  const previewData = $derived.by(() => {
    if (!activeTemplate) return { title: '', content: '' };
    return applyTemplate(activeTemplate, {
      currentContent,
      append: appendMode,
    });
  });

  function handleSelectTemplate(t: NoteTemplate) {
    selectedTemplateId = t.id;
  }

  function handleApply() {
    if (!activeTemplate) return;
    const result = applyTemplate(activeTemplate, {
      currentContent,
      append: appendMode,
    });
    open = false;
    onapply({
      title: result.title,
      content: result.content,
      template: activeTemplate,
    });
    toast.success(`Template "${activeTemplate.name}" berhasil diterapkan.`);
  }

  function handleDeleteCustom(t: NoteTemplate, e: MouseEvent) {
    e.stopPropagation();
    if (confirm(`Hapus template kustom "${t.name}"?`)) {
      deleteUserTemplate(t.id);
      refreshCount++;
      if (selectedTemplateId === t.id) {
        selectedTemplateId = allTemplates[0]?.id ?? 'meeting-notes';
      }
      toast.success('Template kustom dihapus.');
    }
  }

  function openSaveCurrentAsCustom() {
    customName = currentTitle ? `Template: ${currentTitle}` : 'Template Baru';
    customTitlePattern = currentTitle || 'Catatan: {{date}}';
    customDescription = 'Disimpan dari catatan aktif papan.';
    customCategory = 'Umum';
    customContent = currentContent || '# Judul Catatan\n\nIsi template di sini...';
    showCreateCustom = true;
  }

  function handleSaveCustomTemplate(e: SubmitEvent) {
    e.preventDefault();
    if (!customName.trim() || !customContent.trim()) {
      toast.show('Nama dan isi template tidak boleh kosong.', 'info');
      return;
    }

    const saved = saveUserTemplate({
      name: customName.trim(),
      titlePattern: customTitlePattern.trim() || 'Catatan: {{date}}',
      description: customDescription.trim() || 'Template buatan sendiri.',
      category: customCategory,
      iconName: 'sparkles',
      tags: ['custom'],
      content: customContent.trim(),
    });

    refreshCount++;
    selectedTemplateId = saved.id;
    showCreateCustom = false;
    toast.success(`Template kustom "${saved.name}" berhasil disimpan.`);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-150" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 flex h-[90vh] max-h-[750px] w-[95vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-slate-700/80 bg-slate-900 text-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
    >
      <!-- 1. MODAL HEADER -->
      <div class="flex items-center justify-between border-b border-white/10 bg-slate-950/70 px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="grid size-9 place-items-center rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
            <LayoutTemplate class="size-5" />
          </div>
          <div>
            <Dialog.Title class="text-base font-bold">Pilih Template Catatan</Dialog.Title>
            <Dialog.Description class="text-xs text-slate-400 mt-0.5">
              Gunakan struktur dokumen siap pakai untuk notula rapat, bug report, kickoff proyek, dan lainnya.
            </Dialog.Description>
          </div>
        </div>

        <div class="flex items-center gap-2">
          {#if currentContent.trim() && !showCreateCustom}
            <button
              type="button"
              onclick={openSaveCurrentAsCustom}
              class="hidden sm:flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-900/50 transition cursor-pointer"
              title="Simpan isi catatan saat ini menjadi template baru"
            >
              <BookmarkPlus class="size-3.5" />
              <span>Simpan Catatan ini Jadi Template</span>
            </button>
          {/if}

          <Dialog.Close class="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition cursor-pointer" aria-label="Tutup">
            <X class="size-5" />
          </Dialog.Close>
        </div>
      </div>

      {#if showCreateCustom}
        <!-- 2. FORM BUAT TEMPLATE KUSTOM BARU -->
        <form onsubmit={handleSaveCustomTemplate} class="flex flex-1 flex-col overflow-y-auto p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 class="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles class="size-4 text-indigo-400" />
              <span>Buat Template Kustom Baru</span>
            </h3>
            <button
              type="button"
              onclick={() => (showCreateCustom = false)}
              class="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Batal
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="template-name" class="block text-xs font-medium text-slate-300 mb-1.5">Nama Template *</label>
              <input
                id="template-name"
                type="text"
                bind:value={customName}
                placeholder="Contoh: Sprint Review & Demo"
                required
                class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label for="template-title" class="block text-xs font-medium text-slate-300 mb-1.5">
                Pola Judul (Mendukung &#123;&#123;date&#125;&#125;)
              </label>
              <input
                id="template-title"
                type="text"
                bind:value={customTitlePattern}
                placeholder="Contoh: Sprint Review: &#123;&#123;date&#125;&#125;"
                class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="template-desc" class="block text-xs font-medium text-slate-300 mb-1.5">Deskripsi Singkat</label>
              <input
                id="template-desc"
                type="text"
                bind:value={customDescription}
                placeholder="Penjelasan kapan template ini digunakan..."
                class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label for="template-cat" class="block text-xs font-medium text-slate-300 mb-1.5">Kategori</label>
              <select
                id="template-cat"
                bind:value={customCategory}
                class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="Produktivitas">Produktivitas</option>
                <option value="Teknis">Teknis</option>
                <option value="Proyek">Proyek</option>
                <option value="Umum">Umum</option>
              </select>
            </div>
          </div>

          <div class="flex-1 flex flex-col min-h-[220px]">
            <div class="flex items-center justify-between mb-1.5">
              <label for="template-content" class="text-xs font-medium text-slate-300">
                Isi Template Markdown * (Placeholder: &#123;&#123;date&#125;&#125;, &#123;&#123;time&#125;&#125;, &#123;&#123;user&#125;&#125;)
              </label>
            </div>
            <textarea
              id="template-content"
              bind:value={customContent}
              required
              rows="10"
              placeholder="# Judul Template &#123;&#123;date&#125;&#125;&#10;&#10;## Bagian 1&#10;- [ ] Checklist item"
              class="w-full flex-1 rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none leading-relaxed"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onclick={() => (showCreateCustom = false)}
              class="rounded-lg px-4 py-2 text-xs text-slate-300 hover:text-white transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              class="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-semibold text-white shadow-lg transition cursor-pointer"
            >
              <Check class="size-4" />
              <span>Simpan Template Kustom</span>
            </button>
          </div>
        </form>
      {:else}
        <!-- 3. DUA PANEL: DAFTAR TEMPLATE (KIRI) & LIVE PREVIEW (KANAN) -->
        <div class="grid flex-1 grid-cols-1 md:grid-cols-[22rem_1fr] overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/10">
          <!-- PANEL KIRI: DAFTAR & SEARCH -->
          <div class="flex flex-col overflow-hidden bg-slate-950/40">
            <!-- Search & Kategori Pills -->
            <div class="p-3 border-b border-white/10 space-y-2.5">
              <div class="relative flex items-center">
                <Search class="size-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  bind:value={searchQuery}
                  placeholder="Cari template atau tagar…"
                  class="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                {#if searchQuery}
                  <button
                    type="button"
                    onclick={() => (searchQuery = '')}
                    class="absolute right-2.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X class="size-3.5" />
                  </button>
                {/if}
              </div>

              <!-- Kategori Filter -->
              <div class="flex items-center gap-1 overflow-x-auto no-scrollbar text-[11px]">
                {#each [
                  { id: 'all', label: 'Semua' },
                  { id: 'produktivitas', label: 'Produktivitas' },
                  { id: 'teknis', label: 'Teknis' },
                  { id: 'proyek', label: 'Proyek' },
                  { id: 'custom', label: 'Kustom' },
                ] as cat}
                  <button
                    type="button"
                    onclick={() => (selectedCategory = cat.id)}
                    class="rounded-lg px-2 py-0.5 font-medium transition cursor-pointer whitespace-nowrap {selectedCategory === cat.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 text-slate-400 hover:text-white'}"
                  >
                    {cat.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- List Item Template -->
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {#if filteredTemplates.length === 0}
                <div class="py-12 text-center text-xs text-slate-500">
                  Tidak ada template yang cocok dengan filter.
                </div>
              {:else}
                {#each filteredTemplates as item (item.id)}
                  {@const isSelected = selectedTemplateId === item.id}
                  <div
                    role="button"
                    tabindex="0"
                    onclick={() => handleSelectTemplate(item)}
                    onkeydown={(e) => e.key === 'Enter' && handleSelectTemplate(item)}
                    class="group relative flex flex-col gap-1.5 rounded-xl p-3 text-left transition cursor-pointer border {isSelected
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                      : 'border-white/5 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300'}"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <div
                          class="grid size-7 shrink-0 place-items-center rounded-lg {isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-indigo-400 group-hover:text-white'}"
                        >
                          {#if item.iconName === 'users'}
                            <Users class="size-3.5" />
                          {:else if item.iconName === 'bug'}
                            <Bug class="size-3.5" />
                          {:else if item.iconName === 'rocket'}
                            <Rocket class="size-3.5" />
                          {:else if item.iconName === 'sun'}
                            <Sun class="size-3.5" />
                          {:else if item.iconName === 'clipboard-list'}
                            <ClipboardList class="size-3.5" />
                          {:else if item.iconName === 'sparkles'}
                            <Sparkles class="size-3.5" />
                          {:else}
                            <FileText class="size-3.5" />
                          {/if}
                        </div>
                        <span class="font-semibold text-xs truncate {isSelected ? 'text-white' : 'text-slate-200'}">
                          {item.name}
                        </span>
                      </div>

                      <div class="flex items-center gap-1.5 shrink-0">
                        {#if item.isCustom}
                          <button
                            type="button"
                            onclick={(e) => handleDeleteCustom(item, e)}
                            class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition rounded"
                            title="Hapus template kustom"
                          >
                            <Trash2 class="size-3" />
                          </button>
                        {/if}
                        <span class="rounded px-1.5 py-0.2 text-[10px] font-medium {isSelected ? 'bg-indigo-500/30 text-indigo-200' : 'bg-white/5 text-slate-400'}">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <p class="text-[11px] line-clamp-2 leading-relaxed {isSelected ? 'text-indigo-200/90' : 'text-slate-400'}">
                      {item.description}
                    </p>

                    {#if item.tags.length > 0}
                      <div class="flex flex-wrap items-center gap-1 pt-0.5">
                        {#each item.tags as t}
                          {@const style = getTagColor(t)}
                          <span class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-medium border {style.bg} {style.text} {style.border}">
                            <span class="opacity-60">#</span>{t}
                          </span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>

            <!-- Tombol Buat Template Kustom Baru -->
            <div class="p-2.5 border-t border-white/10 bg-slate-950/60">
              <button
                type="button"
                onclick={() => {
                  customName = '';
                  customTitlePattern = 'Catatan: {{date}}';
                  customDescription = '';
                  customCategory = 'Umum';
                  customContent = '# Judul Template\n\nIsi template di sini...';
                  showCreateCustom = true;
                }}
                class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 hover:border-indigo-400/50 hover:bg-indigo-950/30 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer"
              >
                <Plus class="size-3.5 text-indigo-400" />
                <span>+ Buat Template Kustom Sendiri</span>
              </button>
            </div>
          </div>

          <!-- PANEL KANAN: LIVE PREVIEW & APPLY -->
          <div class="flex flex-col overflow-hidden bg-slate-900">
            {#if activeTemplate}
              <!-- Header Preview Info -->
              <div class="flex items-center justify-between border-b border-white/10 bg-slate-950/40 px-5 py-3 text-xs shrink-0">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-white truncate">{previewData.title}</span>
                    {#if activeTemplate.isCustom}
                      <span class="rounded bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 text-[10px] font-medium border border-indigo-500/30">
                        Kustom
                      </span>
                    {/if}
                  </div>
                  <p class="text-[11px] text-slate-400 truncate mt-0.5">
                    Pola judul: <code class="bg-black/30 px-1 py-0.2 rounded text-slate-300">{activeTemplate.titlePattern}</code>
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[11px] text-slate-400 flex items-center gap-1">
                    <Check class="size-3 text-emerald-400" />
                    <span>Variabel &#123;&#123;date&#125;&#125; otomatis terisi</span>
                  </span>
                </div>
              </div>

              <!-- Isi Render Markdown Live Preview -->
              <div class="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div class="markdown-body dark-markdown rounded-xl border border-white/10 bg-slate-950/50 p-5 shadow-inner">
                  {@html renderMarkdown(previewData.content)}
                </div>
              </div>

              <!-- Footer Aksi Pilihan -->
              <div class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/70 px-5 py-3 text-xs shrink-0">
                <div class="flex items-center gap-2">
                  {#if currentContent.trim()}
                    <label class="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white text-xs">
                      <input
                        type="checkbox"
                        bind:checked={appendMode}
                        class="size-3.5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Sisipkan di akhir catatan (jangan timpa isi lama)</span>
                    </label>
                  {:else}
                    <span class="text-[11px] text-slate-400">
                      Catatan kosong: Judul dan isi template akan langsung diterapkan.
                    </span>
                  {/if}
                </div>

                <div class="flex items-center gap-2.5">
                  <button
                    type="button"
                    onclick={() => (open = false)}
                    class="rounded-xl px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onclick={handleApply}
                    class="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                  >
                    <span>{appendMode ? 'Sisipkan Template Ini' : 'Gunakan Template Ini'}</span>
                    <ArrowRight class="size-3.5" />
                  </button>
                </div>
              </div>
            {:else}
              <div class="flex flex-1 items-center justify-center p-8 text-center text-xs text-slate-500">
                Pilih template di kolom sebelah kiri untuk melihat preview.
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
