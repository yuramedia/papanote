<script lang="ts">
  import { onMount } from 'svelte';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Maximize from '@lucide/svelte/icons/maximize';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import Layers from '@lucide/svelte/icons/layers';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Calendar from '@lucide/svelte/icons/calendar';
  import Link2 from '@lucide/svelte/icons/link-2';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';
  import { formatDateTime } from '../lib/format';

  let { store, onopen }: { store: BoardStore; onopen: (id: string) => void } = $props();

  const CARD_WIDTH = 260;
  const CARD_HEIGHT = 150;

  // Viewport Transform
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);

  // Posisi kartu: Map cardId -> { x, y }
  let positions = $state<Record<string, { x: number; y: number }>>({});
  let containerEl: HTMLDivElement;

  // Dragging states
  let isPanning = $state(false);
  let panStartX = 0;
  let panStartY = 0;

  let draggingCardId = $state<string | null>(null);
  let cardDragStartX = 0;
  let cardDragStartY = 0;
  let cardInitialX = 0;
  let cardInitialY = 0;
  let hasMovedCard = false;

  const storageKey = $derived('papanote_canvas_pos_' + (store.board?.id || 'default'));

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

  // Muat posisi tersimpan atau atur posisi awal terkelompok per kolom list
  function loadAndInitPositions() {
    let saved: Record<string, { x: number; y: number }> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = {};
    }

    const activeCards = store.cards.filter((c) => !c.deleted_at);
    const newPositions: Record<string, { x: number; y: number }> = { ...saved };

    // Untuk kartu yang belum memiliki koordinat, susun rapi per kolom list
    const listMap = new Map<string, Card[]>();
    store.lists.forEach((l) => listMap.set(l.id, []));
    activeCards.forEach((c) => {
      const arr = listMap.get(c.list_id);
      if (arr) arr.push(c);
      else listMap.set(c.list_id, [c]);
    });

    let colIdx = 0;
    store.sortedLists.forEach((l) => {
      const cardsInList = listMap.get(l.id) || [];
      cardsInList.forEach((c, rowIdx) => {
        if (!newPositions[c.id]) {
          newPositions[c.id] = {
            x: 80 + colIdx * 320,
            y: 80 + rowIdx * 190,
          };
        }
      });
      if (cardsInList.length > 0) colIdx++;
    });

    positions = newPositions;
  }

  function savePositions() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(positions));
    } catch {
      // Abaikan jika quota storage penuh
    }
  }

  function autoArrange() {
    const newPositions: Record<string, { x: number; y: number }> = {};
    let colIdx = 0;
    store.sortedLists.forEach((l) => {
      const cardsInList = store.cards.filter((c) => !c.deleted_at && c.list_id === l.id);
      cardsInList.forEach((c, rowIdx) => {
        newPositions[c.id] = {
          x: 80 + colIdx * 320,
          y: 80 + rowIdx * 190,
        };
      });
      if (cardsInList.length > 0) colIdx++;
    });
    positions = newPositions;
    savePositions();
    fitView();
  }

  // Koneksi Garis Tautan (Wikilinks Connectors)
  interface CanvasConnection {
    sourceId: string;
    targetId: string;
    path: string;
  }

  const connections = $derived.by<CanvasConnection[]>(() => {
    const activeCards = store.cards.filter((c) => !c.deleted_at);
    const cardMap = new Map<string, Card>();
    activeCards.forEach((c) => {
      cardMap.set(c.id, c);
      cardMap.set(c.title.toLowerCase().trim(), c);
    });

    const conns: CanvasConnection[] = [];

    activeCards.forEach((card) => {
      const srcPos = positions[card.id];
      if (!srcPos) return;

      const content = card.content || '';
      const regex = /\[\[(.*?)\]\]/g;
      let match;

      while ((match = regex.exec(content)) !== null) {
        const rawTarget = match[1].split('|')[0].trim();
        const targetCard = cardMap.get(rawTarget.toLowerCase()) || cardMap.get(rawTarget);

        if (targetCard && targetCard.id !== card.id) {
          const tgtPos = positions[targetCard.id];
          if (!tgtPos) continue;

          // Hitung titik penghubung antar dua kartu
          const srcCenter = { x: srcPos.x + CARD_WIDTH / 2, y: srcPos.y + CARD_HEIGHT / 2 };
          const tgtCenter = { x: tgtPos.x + CARD_WIDTH / 2, y: tgtPos.y + CARD_HEIGHT / 2 };

          // Titik anchor: dari sisi kanan/kiri kartu tergantung posisi
          let x1 = srcPos.x + CARD_WIDTH;
          let y1 = srcCenter.y;
          let x2 = tgtPos.x;
          let y2 = tgtCenter.y;

          if (tgtCenter.x < srcCenter.x) {
            x1 = srcPos.x;
            x2 = tgtPos.x + CARD_WIDTH;
          }

          const dx = Math.abs(x2 - x1) * 0.5;
          const path = `M ${x1} ${y1} C ${x1 + (x2 > x1 ? dx : -dx)} ${y1}, ${x2 + (x2 > x1 ? -dx : dx)} ${y2}, ${x2} ${y2}`;

          conns.push({
            sourceId: card.id,
            targetId: targetCard.id,
            path,
          });
        }
      }
    });

    return conns;
  });

  // Pan & Zoom handlers
  function handleContainerMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-canvas-card]')) return;

    isPanning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanning) {
      panX = e.clientX - panStartX;
      panY = e.clientY - panStartY;
    } else if (draggingCardId) {
      const deltaX = (e.clientX - cardDragStartX) / zoom;
      const deltaY = (e.clientY - cardDragStartY) / zoom;
      if (Math.hypot(deltaX, deltaY) > 3) hasMovedCard = true;

      positions[draggingCardId] = {
        x: Math.round(cardInitialX + deltaX),
        y: Math.round(cardInitialY + deltaY),
      };
    }
  }

  function handleMouseUp() {
    if (draggingCardId) {
      if (hasMovedCard) {
        savePositions();
      }
      draggingCardId = null;
    }
    isPanning = false;
  }

  function handleCardMouseDown(e: MouseEvent, cardId: string) {
    if (e.button !== 0) return;
    e.stopPropagation();

    draggingCardId = cardId;
    cardDragStartX = e.clientX;
    cardDragStartY = e.clientY;
    const current = positions[cardId] || { x: 0, y: 0 };
    cardInitialX = current.x;
    cardInitialY = current.y;
    hasMovedCard = false;
  }

  function handleCardClick(e: MouseEvent, cardId: string) {
    if (!hasMovedCard) {
      onopen(cardId);
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.min(2.5, Math.max(0.25, zoom * zoomFactor));

    const rect = containerEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    panX = mouseX - (mouseX - panX) * (newZoom / zoom);
    panY = mouseY - (mouseY - panY) * (newZoom / zoom);
    zoom = newZoom;
  }

  function zoomIn() {
    zoom = Math.min(2.5, zoom * 1.25);
  }

  function zoomOut() {
    zoom = Math.max(0.25, zoom * 0.8);
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  function fitView() {
    const activeCards = store.cards.filter((c) => !c.deleted_at);
    if (activeCards.length === 0 || !containerEl) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    activeCards.forEach((c) => {
      const p = positions[c.id];
      if (p) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x + CARD_WIDTH);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y + CARD_HEIGHT);
      }
    });

    if (minX === Infinity) return;

    const width = containerEl.clientWidth;
    const height = containerEl.clientHeight;
    const graphWidth = maxX - minX + 160;
    const graphHeight = maxY - minY + 160;

    const newZoom = Math.min(1.5, Math.max(0.35, Math.min(width / graphWidth, height / graphHeight)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    panX = width / 2 - centerX * newZoom;
    panY = height / 2 - centerY * newZoom;
    zoom = newZoom;
  }

  onMount(() => {
    loadAndInitPositions();
    setTimeout(fitView, 100);
  });

  $effect(() => {
    const _c = store.cards.length;
    const _l = store.lists.length;
    loadAndInitPositions();
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={containerEl}
  onmousedown={handleContainerMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onwheel={handleWheel}
  class="relative h-full w-full flex-1 overflow-hidden select-none bg-slate-950 cursor-{isPanning ? 'grabbing' : 'grab'}"
>
  <!-- Background Infinite Dot Grid -->
  <div
    class="pointer-events-none absolute inset-0 opacity-20"
    style="
      background-size: {32 * zoom}px {32 * zoom}px;
      background-position: {panX}px {panY}px;
      background-image: radial-gradient(circle, #818cf8 1.5px, transparent 1.5px);
    "
  ></div>

  <!-- Bidang Kanvas Ter-transformasi (Cards & Connectors) -->
  <div
    class="absolute inset-0 origin-top-left will-change-transform"
    style="transform: translate3d({panX}px, {panY}px, 0) scale({zoom});"
  >
    <!-- Layer SVG: Panah Penghubung Tautan Wikilinks -->
    <svg class="pointer-events-none absolute inset-0 h-[20000px] w-[20000px] overflow-visible">
      <defs>
        <marker
          id="canvas-arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#818cf8" />
        </marker>
      </defs>

      {#each connections as conn}
        <path
          d={conn.path}
          fill="none"
          stroke="#6366f1"
          stroke-width="2"
          stroke-opacity="0.6"
          marker-end="url(#canvas-arrow)"
          class="transition-all duration-75"
        />
      {/each}
    </svg>

    <!-- Layer Kartu Catatan Bebas (Canvas Cards) -->
    {#each store.cards.filter((c) => !c.deleted_at) as card (card.id)}
      {@const pos = positions[card.id] || { x: 100, y: 100 }}
      {@const isDragging = draggingCardId === card.id}
      <div
        data-canvas-card
        role="button"
        tabindex="0"
        onmousedown={(e) => handleCardMouseDown(e, card.id)}
        onclick={(e) => handleCardClick(e, card.id)}
        onkeydown={(e) => e.key === 'Enter' && onopen(card.id)}
        class="absolute flex flex-col rounded-2xl border bg-slate-900/95 p-3.5 text-white shadow-xl backdrop-blur-md transition-shadow cursor-{isDragging ? 'grabbing' : 'grab'} hover:shadow-2xl hover:border-indigo-500/60"
        style="
          width: {CARD_WIDTH}px;
          min-height: {CARD_HEIGHT}px;
          transform: translate3d({pos.x}px, {pos.y}px, 0);
          border-color: {isDragging ? '#818cf8' : 'rgba(255, 255, 255, 0.12)'};
          z-index: {isDragging ? 40 : 10};
        "
      >
        <!-- Header Kartu -->
        <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <span
            class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase truncate max-w-[170px]"
            style="background-color: {getListColor(card.list_id)}20; color: {getListColor(card.list_id)};"
          >
            <span class="size-1.5 rounded-full" style="background-color: {getListColor(card.list_id)}"></span>
            {getListTitle(card.list_id)}
          </span>
          <button
            type="button"
            class="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            onclick={(e) => {
              e.stopPropagation();
              onopen(card.id);
            }}
            title="Buka Catatan"
          >
            <ExternalLink class="size-3.5" />
          </button>
        </div>

        <!-- Judul Kartu -->
        <h3 class="mt-2 text-xs font-semibold text-white leading-snug line-clamp-2">
          {card.title}
        </h3>

        <!-- Ringkasan Isi Markdown -->
        <p class="mt-1 text-[11px] text-white/50 line-clamp-2 leading-relaxed font-sans">
          {card.content || 'Belum ada isi catatan…'}
        </p>

        <!-- Footer Kartu: Deadline & Info -->
        <div class="mt-auto flex items-center justify-between pt-2 text-[10px] text-white/40">
          {#if card.deadline_date}
            <span class="flex items-center gap-1 text-amber-400/90 font-medium truncate">
              <Calendar class="size-3" />
              {formatDateTime(card.deadline_date).slice(0, 10)}
            </span>
          {:else}
            <span></span>
          {/if}

          {#if card.content && card.content.includes('[[')}
            <span class="flex items-center gap-1 text-indigo-400 font-medium">
              <Link2 class="size-3" />
              Tersambung
            </span>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Toolbar Kontrol Sudut Kanan Atas -->
  <div class="absolute right-4 top-4 flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 p-1.5 backdrop-blur-md shadow-xl text-white">
    <button
      type="button"
      onclick={autoArrange}
      class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      title="Susun Ulang Rapi (Auto-Arrange)"
    >
      <LayoutGrid class="size-3.5 text-indigo-400" />
      <span class="hidden sm:inline">Tata Rapi</span>
    </button>
    <div class="h-4 w-px bg-white/10"></div>
    <button
      type="button"
      onclick={zoomIn}
      class="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      title="Perbesar (Zoom In)"
    >
      <ZoomIn class="size-4" />
    </button>
    <button
      type="button"
      onclick={zoomOut}
      class="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      title="Perkecil (Zoom Out)"
    >
      <ZoomOut class="size-4" />
    </button>
    <button
      type="button"
      onclick={fitView}
      class="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      title="Fokus Seluruh Kanvas (Fit to View)"
    >
      <Maximize class="size-4" />
    </button>
    <button
      type="button"
      onclick={resetView}
      class="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      title="Reset Tampilan (100%)"
    >
      <RotateCcw class="size-4" />
    </button>
  </div>

  <!-- Info & Statistik Sudut Kiri Bawah -->
  <div class="absolute bottom-4 left-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs text-white/80 backdrop-blur-md shadow-lg pointer-events-none">
    <div class="flex items-center gap-1.5 text-indigo-400 font-medium">
      <Layers class="size-4" />
      <span>Obsidian Canvas</span>
    </div>
    <span class="text-white/20">|</span>
    <span>{store.cards.filter((c) => !c.deleted_at).length} Kartu</span>
    <span class="text-white/20">•</span>
    <span>{connections.length} Panah Relasi</span>
  </div>

  <!-- Tips Penggunaan Sudut Kanan Bawah -->
  <div class="absolute bottom-4 right-4 hidden md:flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-[11px] text-white/50 backdrop-blur-md shadow-lg pointer-events-none">
    <span>💡 Drag kartu untuk mengatur posisi bebas • Klik untuk membuka detail • Scroll untuk zoom</span>
  </div>
</div>
