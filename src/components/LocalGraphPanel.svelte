<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Network from '@lucide/svelte/icons/network';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Compass from '@lucide/svelte/icons/compass';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';

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
  let depth = $state<1 | 2>(1); // 1-hop vs 2-hop

  interface LocalNode {
    id: string;
    title: string;
    listTitle: string;
    color: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    isCenter: boolean;
    hop: number;
  }

  interface LocalEdge {
    source: string;
    target: string;
  }

  let canvasContainer = $state<HTMLDivElement | null>(null);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let ctx: CanvasRenderingContext2D | null = null;
  let animId: number = 0;

  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let hoveredNode = $state<LocalNode | null>(null);
  let draggedNode: LocalNode | null = null;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let mouseStartX = 0;
  let mouseStartY = 0;
  let hasMoved = false;

  let localNodes = $state<LocalNode[]>([]);
  let localEdges = $state<LocalEdge[]>([]);

  const LIST_COLORS = [
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#ec4899',
    '#06b6d4',
    '#8b5cf6',
    '#f97316',
    '#14b8a6',
  ];

  function getListColor(listId: string): string {
    const idx = store.lists.findIndex((l) => l.id === listId);
    if (idx === -1) return '#64748b';
    return LIST_COLORS[idx % LIST_COLORS.length];
  }

  // Parse wikilinks dari konten kartu
  function extractLinkedCardIds(content: string, cardMap: Map<string, Card>): string[] {
    const regex = /\[\[(.*?)\]\]/g;
    const targetIds: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const raw = match[1].split('|')[0].trim();
      const target = cardMap.get(raw.toLowerCase()) || cardMap.get(raw);
      if (target) {
        targetIds.push(target.id);
      }
    }
    return targetIds;
  }

  function buildLocalGraph() {
    const activeCards = store.cards.filter((c) => !c.deleted_at);
    const cardMap = new Map<string, Card>();
    activeCards.forEach((c) => {
      cardMap.set(c.id, c);
      cardMap.set(c.title.toLowerCase().trim(), c);
    });

    // Peta koneksi outgoing dari setiap kartu
    const outgoingMap = new Map<string, string[]>();
    activeCards.forEach((c) => {
      outgoingMap.set(c.id, extractLinkedCardIds(c.content || '', cardMap));
    });

    // Cari hop 1
    const hop1Set = new Set<string>();
    // 1a. Kartu yang di-link oleh currentCard
    const currentOutgoing = outgoingMap.get(currentCard.id) || [];
    currentOutgoing.forEach((id) => {
      if (id !== currentCard.id) hop1Set.add(id);
    });
    // 1b. Kartu yang me-link ke currentCard (incoming)
    activeCards.forEach((c) => {
      if (c.id !== currentCard.id) {
        const out = outgoingMap.get(c.id) || [];
        if (out.includes(currentCard.id)) {
          hop1Set.add(c.id);
        }
      }
    });

    // Cari hop 2 jika aktif
    const hop2Set = new Set<string>();
    if (depth >= 2) {
      hop1Set.forEach((h1Id) => {
        // Outgoing dari hop 1
        const out = outgoingMap.get(h1Id) || [];
        out.forEach((id) => {
          if (id !== currentCard.id && !hop1Set.has(id)) {
            hop2Set.add(id);
          }
        });
        // Incoming ke hop 1
        activeCards.forEach((c) => {
          if (c.id !== currentCard.id && !hop1Set.has(c.id)) {
            const cOut = outgoingMap.get(c.id) || [];
            if (cOut.includes(h1Id)) {
              hop2Set.add(c.id);
            }
          }
        });
      });
    }

    const allNodeIds = new Set<string>([currentCard.id, ...hop1Set, ...hop2Set]);
    const edges: LocalEdge[] = [];

    // Hubungkan edge antar node yang masuk dalam graf lokal
    allNodeIds.forEach((sourceId) => {
      const out = outgoingMap.get(sourceId) || [];
      out.forEach((targetId) => {
        if (allNodeIds.has(targetId) && sourceId !== targetId) {
          const exists = edges.some((e) => e.source === sourceId && e.target === targetId);
          if (!exists) {
            edges.push({ source: sourceId, target: targetId });
          }
        }
      });
    });

    const width = canvasContainer ? canvasContainer.clientWidth : 500;
    const height = canvasContainer ? canvasContainer.clientHeight : 240;
    const centerX = width / 2;
    const centerY = height / 2;

    const existingNodeMap = new Map(localNodes.map((n) => [n.id, n]));
    const nodes: LocalNode[] = [];

    // Node pusat (currentCard)
    const centerExisting = existingNodeMap.get(currentCard.id);
    const centerList = store.lists.find((l) => l.id === currentCard.list_id);
    nodes.push({
      id: currentCard.id,
      title: currentCard.title,
      listTitle: centerList?.title ?? 'List',
      color: '#6366f1',
      x: centerExisting ? centerExisting.x : centerX,
      y: centerExisting ? centerExisting.y : centerY,
      vx: 0,
      vy: 0,
      radius: 20,
      isCenter: true,
      hop: 0,
    });

    // Hop 1 nodes
    let idx = 0;
    const hop1Count = hop1Set.size;
    hop1Set.forEach((id) => {
      const c = cardMap.get(id);
      if (!c) return;
      const existing = existingNodeMap.get(id);
      const angle = (idx / Math.max(1, hop1Count)) * Math.PI * 2;
      const dist = 80;
      const list = store.lists.find((l) => l.id === c.list_id);
      nodes.push({
        id: c.id,
        title: c.title,
        listTitle: list?.title ?? 'List',
        color: getListColor(c.list_id),
        x: existing ? existing.x : centerX + Math.cos(angle) * dist,
        y: existing ? existing.y : centerY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: 14,
        isCenter: false,
        hop: 1,
      });
      idx++;
    });

    // Hop 2 nodes
    let idx2 = 0;
    const hop2Count = hop2Set.size;
    hop2Set.forEach((id) => {
      const c = cardMap.get(id);
      if (!c) return;
      const existing = existingNodeMap.get(id);
      const angle = (idx2 / Math.max(1, hop2Count)) * Math.PI * 2;
      const dist = 145;
      const list = store.lists.find((l) => l.id === c.list_id);
      nodes.push({
        id: c.id,
        title: c.title,
        listTitle: list?.title ?? 'List',
        color: getListColor(c.list_id),
        x: existing ? existing.x : centerX + Math.cos(angle) * dist,
        y: existing ? existing.y : centerY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: 11,
        isCenter: false,
        hop: 2,
      });
      idx2++;
    });

    localNodes = nodes;
    localEdges = edges;
  }

  function stepPhysics() {
    const width = canvasContainer ? canvasContainer.clientWidth : 500;
    const height = canvasContainer ? canvasContainer.clientHeight : 240;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodeMap = new Map(localNodes.map((n) => [n.id, n]));

    // 1. Repulsion
    for (let i = 0; i < localNodes.length; i++) {
      for (let j = i + 1; j < localNodes.length; j++) {
        const n1 = localNodes[i];
        const n2 = localNodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy || 1;
        const dist = Math.sqrt(distSq);

        if (dist < 260) {
          const force = 1200 / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (n1 !== draggedNode && !n1.isCenter) {
            n1.vx -= fx;
            n1.vy -= fy;
          }
          if (n2 !== draggedNode && !n2.isCenter) {
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }
    }

    // 2. Spring attraction
    for (const edge of localEdges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const desiredDist = 75;
      const force = (dist - desiredDist) * 0.04;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (source !== draggedNode && !source.isCenter) {
        source.vx += fx;
        source.vy += fy;
      }
      if (target !== draggedNode && !target.isCenter) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // 3. Center anchoring & Damping
    for (const node of localNodes) {
      if (node.isCenter) {
        // Node pusat tetap di tengah
        node.x += (centerX - node.x) * 0.1;
        node.y += (centerY - node.y) * 0.1;
        continue;
      }
      if (node === draggedNode) continue;

      const dx = centerX - node.x;
      const dy = centerY - node.y;
      node.vx += dx * 0.006;
      node.vy += dy * 0.006;

      node.vx *= 0.85;
      node.vy *= 0.85;

      node.x += node.vx;
      node.y += node.vy;
    }
  }

  function draw() {
    if (!ctx || !canvas) return;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Latar Belakang slate-950
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Titik grid lembut
    const gridSize = 24;
    const left = -panX / zoom;
    const top = -panY / zoom;
    const right = left + width / zoom;
    const bottom = top + height / zoom;

    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = startX; x <= right; x += gridSize) {
      for (let y = startY; y <= bottom; y += gridSize) {
        ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }
    }

    const nodeMap = new Map(localNodes.map((n) => [n.id, n]));
    const hoveredId = hoveredNode?.id;

    // 1. Gambar Edges dengan panah
    for (const edge of localEdges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const isHoverConnected = hoveredId && (edge.source === hoveredId || edge.target === hoveredId);
      const isCenterConnected = edge.source === currentCard.id || edge.target === currentCard.id;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (isHoverConnected) {
        ctx.strokeStyle = '#a5b4fc';
        ctx.lineWidth = 2.2 / zoom;
        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 6;
      } else if (isCenterConnected) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.lineWidth = 1.6 / zoom;
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1 / zoom;
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      // Panah penunjuk arah
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > target.radius + 8) {
        const arrowLen = 6;
        const arrowAngle = Math.PI / 7;
        const targetEdgeX = target.x - (dx / dist) * (target.radius + 2);
        const targetEdgeY = target.y - (dy / dist) * (target.radius + 2);
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(targetEdgeX, targetEdgeY);
        ctx.lineTo(
          targetEdgeX - arrowLen * Math.cos(angle - arrowAngle),
          targetEdgeY - arrowLen * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
          targetEdgeX - arrowLen * Math.cos(angle + arrowAngle),
          targetEdgeY - arrowLen * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fillStyle = isHoverConnected ? '#a5b4fc' : isCenterConnected ? '#818cf8' : 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. Gambar Nodes
    for (const node of localNodes) {
      const isHovered = hoveredId === node.id;

      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      if (node.isCenter) {
        // Lingkaran luar glowing untuk node pusat
        ctx.shadowColor = '#818cf8';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.lineWidth = 3 / zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else if (isHovered) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.lineWidth = 2.5 / zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 4;
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.lineWidth = 1.2 / zoom;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.stroke();
      }
      ctx.restore();

      // Label Judul
      ctx.save();
      ctx.font = `${node.isCenter || isHovered ? '600' : '500'} ${Math.max(9, 11 / Math.min(1, zoom))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const labelY = node.y + node.radius + 4;
      const text = node.title.length > 20 ? node.title.slice(0, 18) + '…' : node.title;

      if (node.isCenter || isHovered) {
        const metrics = ctx.measureText(text);
        const padding = 5;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(
          node.x - metrics.width / 2 - padding,
          labelY - 1,
          metrics.width + padding * 2,
          15
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(
          node.x - metrics.width / 2 - padding,
          labelY - 1,
          metrics.width + padding * 2,
          15
        );
      }

      ctx.fillStyle = node.isCenter ? '#a5b4fc' : isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(text, node.x, labelY);
      ctx.restore();
    }

    ctx.restore();
  }

  function animate() {
    stepPhysics();
    draw();
    animId = requestAnimationFrame(animate);
  }

  function screenToWorld(clientX: number, clientY: number) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - panX) / zoom;
    const y = (clientY - rect.top - panY) / zoom;
    return { x, y };
  }

  function findNodeUnder(clientX: number, clientY: number): LocalNode | null {
    const { x, y } = screenToWorld(clientX, clientY);
    for (let i = localNodes.length - 1; i >= 0; i--) {
      const node = localNodes[i];
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= (node.radius + 5) * (node.radius + 5)) {
        return node;
      }
    }
    return null;
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
    hasMoved = false;

    const hit = findNodeUnder(e.clientX, e.clientY);
    if (hit) {
      draggedNode = hit;
    } else {
      isPanning = true;
      panStartX = e.clientX - panX;
      panStartY = e.clientY - panY;
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const dist = Math.hypot(e.clientX - mouseStartX, e.clientY - mouseStartY);
    if (dist > 4) hasMoved = true;

    if (draggedNode) {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      draggedNode.x = x;
      draggedNode.y = y;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
    } else if (isPanning) {
      panX = e.clientX - panStartX;
      panY = e.clientY - panStartY;
    } else {
      hoveredNode = findNodeUnder(e.clientX, e.clientY);
    }
  }

  function handleMouseUp() {
    if (!hasMoved && draggedNode && !draggedNode.isCenter) {
      onnavigate(draggedNode.id);
    }
    draggedNode = null;
    isPanning = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.min(2.5, Math.max(0.5, zoom * factor));
  }

  function handleResize() {
    if (!canvas || !canvasContainer) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    if (ctx) ctx.scale(dpr, dpr);
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      handleResize();
      buildLocalGraph();
      animId = requestAnimationFrame(animate);
    }
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', handleResize);
  });

  $effect(() => {
    // Pantau perubahan kartu aktif atau depth
    const _cid = currentCard.id;
    const _cTitle = currentCard.title;
    const _d = depth;
    const _cl = store.cards.length;
    buildLocalGraph();
  });
</script>

<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition-colors">
  <!-- Accordion Toggle Header -->
  <button
    type="button"
    class="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
    onclick={() => (isOpen = !isOpen)}
  >
    <div class="flex items-center gap-2">
      <Network class="size-4 text-indigo-600" />
      <span class="tracking-wide uppercase text-[11px] font-bold text-slate-600">Graf Lokal (Local Graph)</span>
      <span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
        {localNodes.length - 1} Terhubung • {depth} Hop
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
    <div class="mt-3 space-y-2">
      <!-- Toolbar Pengaturan Mini & Depth Toggle -->
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] text-slate-500 font-medium">Jarak Hop:</span>
          <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
            <button
              type="button"
              onclick={() => (depth = 1)}
              class="rounded-md px-2 py-0.5 font-medium transition cursor-pointer {depth === 1
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'}"
            >
              1 Hop
            </button>
            <button
              type="button"
              onclick={() => (depth = 2)}
              class="rounded-md px-2 py-0.5 font-medium transition cursor-pointer {depth === 2
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'}"
            >
              2 Hop
            </button>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            type="button"
            onclick={() => (zoom = Math.min(2.5, zoom * 1.2))}
            class="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
            title="Perbesar"
          >
            <ZoomIn class="size-3.5" />
          </button>
          <button
            type="button"
            onclick={() => (zoom = Math.max(0.5, zoom * 0.8))}
            class="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
            title="Perkecil"
          >
            <ZoomOut class="size-3.5" />
          </button>
          <button
            type="button"
            onclick={resetView}
            class="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
            title="Reset Posisi"
          >
            <RotateCcw class="size-3.5" />
          </button>
        </div>
      </div>

      <!-- Canvas Graf Lokal -->
      <div
        bind:this={canvasContainer}
        class="relative h-[220px] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-inner select-none cursor-{hoveredNode && !hoveredNode.isCenter ? 'pointer' : 'grab'}"
      >
        <canvas
          bind:this={canvas}
          onmousedown={handleMouseDown}
          onmousemove={handleMouseMove}
          onmouseup={handleMouseUp}
          onwheel={handleWheel}
          class="block h-full w-full"
        ></canvas>

        {#if localNodes.length <= 1}
          <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/50 text-xs">
            <Compass class="size-5 text-indigo-400 opacity-60" />
            <span>Belum ada hubungan tautan di sekitar catatan ini.</span>
          </div>
        {/if}

        {#if hoveredNode && !hoveredNode.isCenter}
          <div
            class="pointer-events-none absolute z-20 flex flex-col gap-0.5 rounded-lg border border-indigo-500/40 bg-slate-950/95 px-2.5 py-1.5 text-xs text-white shadow-xl backdrop-blur-md"
            style="left: {panX + hoveredNode.x * zoom + 12}px; top: {panY + hoveredNode.y * zoom - 20}px;"
          >
            <span class="font-semibold text-indigo-300">{hoveredNode.title}</span>
            <span class="text-[10px] text-white/60">{hoveredNode.listTitle} • Hop {hoveredNode.hop}</span>
            <span class="text-[9px] text-indigo-400">Klik untuk melompat</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
