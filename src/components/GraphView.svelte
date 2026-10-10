<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ZoomIn from '@lucide/svelte/icons/zoom-in';
  import ZoomOut from '@lucide/svelte/icons/zoom-out';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Maximize from '@lucide/svelte/icons/maximize';
  import Network from '@lucide/svelte/icons/network';
  import type { BoardStore } from '../lib/board.svelte';
  import type { Card } from '../lib/types';

  let { store, onopen }: { store: BoardStore; onopen: (id: string) => void } = $props();

  interface NodeItem {
    id: string;
    title: string;
    listTitle: string;
    color: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    connections: number;
  }

  interface EdgeItem {
    source: string;
    target: string;
  }

  let canvasContainer: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let animId: number = 0;

  // Viewport Transform (Pan & Zoom)
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);

  // Status Graf & Interaksi
  let nodes = $state<NodeItem[]>([]);
  let edges = $state<EdgeItem[]>([]);
  let hoveredNode = $state<NodeItem | null>(null);
  let draggedNode: NodeItem | null = null;
  let isPanning = $state(false);
  let panStartX = 0;
  let panStartY = 0;
  let mouseStartX = 0;
  let mouseStartY = 0;
  let hasMoved = false;

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

  // Bangun struktur nodes & edges dari store.cards
  function buildGraph() {
    const activeCards = store.cards.filter((c) => !c.deleted_at);
    const cardMap = new Map<string, Card>();
    activeCards.forEach((c) => {
      cardMap.set(c.id, c);
      cardMap.set(c.title.toLowerCase().trim(), c);
    });

    const newEdges: EdgeItem[] = [];
    const connectionCounts = new Map<string, number>();

    activeCards.forEach((card) => {
      connectionCounts.set(card.id, 0);
      const content = card.content || '';
      const regex = /\[\[(.*?)\]\]/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const rawTarget = match[1].split('|')[0].trim();
        const targetCard = cardMap.get(rawTarget.toLowerCase()) || cardMap.get(rawTarget);
        if (targetCard && targetCard.id !== card.id) {
          // Hindari duplikat edge searah
          const exists = newEdges.some(
            (e) => e.source === card.id && e.target === targetCard.id
          );
          if (!exists) {
            newEdges.push({ source: card.id, target: targetCard.id });
            connectionCounts.set(card.id, (connectionCounts.get(card.id) || 0) + 1);
            connectionCounts.set(targetCard.id, (connectionCounts.get(targetCard.id) || 0) + 1);
          }
        }
      }
    });

    // Pertahankan posisi node yang sudah ada jika memungkinkan
    const existingNodeMap = new Map(nodes.map((n) => [n.id, n]));
    const width = canvasContainer ? canvasContainer.clientWidth : 800;
    const height = canvasContainer ? canvasContainer.clientHeight : 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const newNodes: NodeItem[] = activeCards.map((card, i) => {
      const existing = existingNodeMap.get(card.id);
      const connections = connectionCounts.get(card.id) || 0;
      const radius = Math.min(28, Math.max(14, 14 + connections * 3.5));
      const list = store.lists.find((l) => l.id === card.list_id);

      if (existing) {
        return {
          ...existing,
          title: card.title,
          listTitle: list?.title ?? 'List',
          color: getListColor(card.list_id),
          radius,
          connections,
        };
      }

      // Distribusi lingkaran awal
      const angle = (i / Math.max(1, activeCards.length)) * Math.PI * 2;
      const dist = 100 + Math.random() * 180;
      return {
        id: card.id,
        title: card.title,
        listTitle: list?.title ?? 'List',
        color: getListColor(card.list_id),
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius,
        connections,
      };
    });

    nodes = newNodes;
    edges = newEdges;
  }

  // Simulasi gaya fisika (Force-directed graph layout)
  function stepPhysics() {
    const width = canvasContainer ? canvasContainer.clientWidth : 800;
    const height = canvasContainer ? canvasContainer.clientHeight : 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // 1. Gaya tolak-menolak antar semua node (Coulomb Repulsion)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy || 1;
        const dist = Math.sqrt(distSq);

        if (dist < 400) {
          const force = 1800 / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (n1 !== draggedNode) {
            n1.vx -= fx;
            n1.vy -= fy;
          }
          if (n2 !== draggedNode) {
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }
    }

    // 2. Gaya tarik-menarik pegas pada garis relasi (Hooke Spring Attraction)
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const desiredDist = 120;
      const force = (dist - desiredDist) * 0.035;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (source !== draggedNode) {
        source.vx += fx;
        source.vy += fy;
      }
      if (target !== draggedNode) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // 3. Gravitasi lembut menuju titik tengah (Centering force)
    for (const node of nodes) {
      if (node === draggedNode) continue;
      const dx = centerX - node.x;
      const dy = centerY - node.y;
      node.vx += dx * 0.005;
      node.vy += dy * 0.005;

      // Gesekan / Damping kecepatan
      node.vx *= 0.88;
      node.vy *= 0.88;

      // Update posisi
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  // Render kanvas visual
  function draw() {
    if (!ctx || !canvas) return;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Latar Belakang & Pola Titik Grid (Dot Pattern)
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Terapkan Pan & Zoom
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Gambar Pola Dot Grid di area yang ter-transformasi
    const gridSize = 32;
    const left = -panX / zoom;
    const top = -panY / zoom;
    const right = left + width / zoom;
    const bottom = top + height / zoom;

    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = startX; x <= right; x += gridSize) {
      for (let y = startY; y <= bottom; y += gridSize) {
        ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      }
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const hoveredId = hoveredNode?.id;

    // 1. Gambar Edges / Garis Penghubung
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const isConnectedToHover = hoveredId && (edge.source === hoveredId || edge.target === hoveredId);
      const isDimmed = hoveredId && !isConnectedToHover;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (isConnectedToHover) {
        ctx.strokeStyle = '#818cf8'; // indigo-400 terang
        ctx.lineWidth = 2.5 / zoom;
        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 8;
      } else if (isDimmed) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1 / zoom;
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.2 / zoom;
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    }

    // 2. Gambar Nodes (Lingkaran)
    for (const node of nodes) {
      const isHovered = hoveredId === node.id;
      const isConnected = hoveredId && edges.some(
        (e) => (e.source === hoveredId && e.target === node.id) || (e.target === hoveredId && e.source === node.id)
      );
      const isDimmed = hoveredId && !isHovered && !isConnected;

      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      if (isHovered) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.lineWidth = 3 / zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else if (isDimmed) {
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.lineWidth = 1 / zoom;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();
      } else {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.lineWidth = 1.5 / zoom;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.stroke();
      }
      ctx.restore();

      // 3. Label Judul Kartu
      const showLabel = zoom > 0.45 || isHovered || isConnected;
      if (showLabel) {
        ctx.save();
        ctx.font = `${isHovered ? '600' : '500'} ${Math.max(10, 12 / Math.min(1, zoom))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelY = node.y + node.radius + 6;
        const text = node.title.length > 24 ? node.title.slice(0, 22) + '…' : node.title;

        // Background pill untuk label saat di-hover
        if (isHovered) {
          const metrics = ctx.measureText(text);
          const padding = 6;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(
            node.x - metrics.width / 2 - padding,
            labelY - 2,
            metrics.width + padding * 2,
            18
          );
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            node.x - metrics.width / 2 - padding,
            labelY - 2,
            metrics.width + padding * 2,
            18
          );
        }

        ctx.fillStyle = isDimmed ? 'rgba(255, 255, 255, 0.3)' : isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(text, node.x, labelY);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // Loop Animasi
  function animate() {
    stepPhysics();
    draw();
    animId = requestAnimationFrame(animate);
  }

  // Mengubah koordinat layar (screen) ke koordinat dunia graf (world)
  function screenToWorld(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - panX) / zoom;
    const y = (clientY - rect.top - panY) / zoom;
    return { x, y };
  }

  function findNodeUnder(clientX: number, clientY: number): NodeItem | null {
    const { x, y } = screenToWorld(clientX, clientY);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= (node.radius + 6) * (node.radius + 6)) {
        return node;
      }
    }
    return null;
  }

  // Event Handlers
  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Hanya klik kiri
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
    const distMoved = Math.hypot(e.clientX - mouseStartX, e.clientY - mouseStartY);
    if (distMoved > 4) hasMoved = true;

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

  function handleMouseUp(e: MouseEvent) {
    if (!hasMoved && draggedNode) {
      // Klik tanpa drag -> buka detail kartu
      onopen(draggedNode.id);
    }
    draggedNode = null;
    isPanning = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.min(3.0, Math.max(0.2, zoom * zoomFactor));

    // Zoom memusat ke kursor mouse
    const rect = canvas.getBoundingClientRect();
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    panX = mouseCanvasX - (mouseCanvasX - panX) * (newZoom / zoom);
    panY = mouseCanvasY - (mouseCanvasY - panY) * (newZoom / zoom);
    zoom = newZoom;
  }

  function zoomIn() {
    zoom = Math.min(3.0, zoom * 1.25);
  }

  function zoomOut() {
    zoom = Math.max(0.2, zoom * 0.8);
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  function fitView() {
    if (nodes.length === 0 || !canvasContainer) return;
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      minX = Math.min(minX, n.x - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    });

    const graphWidth = maxX - minX + 120;
    const graphHeight = maxY - minY + 120;
    const newZoom = Math.min(1.8, Math.max(0.3, Math.min(width / graphWidth, height / graphHeight)));

    const graphCenterX = (minX + maxX) / 2;
    const graphCenterY = (minY + maxY) / 2;

    panX = width / 2 - graphCenterX * newZoom;
    panY = height / 2 - graphCenterY * newZoom;
    zoom = newZoom;
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

  onMount(() => {
    ctx = canvas.getContext('2d');
    handleResize();
    buildGraph();
    fitView();
    window.addEventListener('resize', handleResize);
    animId = requestAnimationFrame(animate);
  });

  onDestroy(() => {
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', handleResize);
  });

  // Re-build graph jika cards / lists di store berubah
  $effect(() => {
    // pantau dependensi reaktif
    const _c = store.cards.length;
    const _l = store.lists.length;
    buildGraph();
  });
</script>

<div
  bind:this={canvasContainer}
  class="relative h-full w-full flex-1 overflow-hidden select-none bg-slate-900 cursor-{isPanning ? 'grabbing' : hoveredNode ? 'pointer' : 'grab'}"
>
  <canvas
    bind:this={canvas}
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onwheel={handleWheel}
    class="block h-full w-full"
  ></canvas>

  <!-- Toolbar Kontrol Sudut Kanan Atas -->
  <div class="absolute right-4 top-4 flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 p-1.5 backdrop-blur-md shadow-xl text-white">
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
      title="Fokus Seluruh Graf (Fit to View)"
    >
      <Maximize class="size-4" />
    </button>
    <button
      type="button"
      onclick={resetView}
      class="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      title="Reset Posisi (100%)"
    >
      <RotateCcw class="size-4" />
    </button>
  </div>

  <!-- Info & Statistik Graf Sudut Kiri Bawah -->
  <div class="absolute bottom-4 left-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs text-white/80 backdrop-blur-md shadow-lg pointer-events-none">
    <div class="flex items-center gap-1.5 text-indigo-400 font-medium">
      <Network class="size-4" />
      <span>Obsidian Graph View</span>
    </div>
    <span class="text-white/20">|</span>
    <span>{nodes.length} Catatan</span>
    <span class="text-white/20">•</span>
    <span>{edges.length} Tautan Terhubung</span>
  </div>

  <!-- Legend Warna List Sudut Kanan Bawah -->
  {#if store.lists.length > 0}
    <div class="absolute bottom-4 right-4 hidden md:flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs backdrop-blur-md shadow-lg pointer-events-none">
      <span class="text-white/40 text-[11px] uppercase tracking-wider font-semibold">List:</span>
      {#each store.lists as list}
        <div class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-full" style="background-color: {getListColor(list.id)}"></span>
          <span class="text-white/70 truncate max-w-[90px]">{list.title}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Tooltip info saat hover node -->
  {#if hoveredNode}
    <div
      class="pointer-events-none absolute z-30 flex flex-col gap-0.5 rounded-xl border border-indigo-500/30 bg-slate-950/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-md text-white transition-all duration-75"
      style="left: {panX + hoveredNode.x * zoom + 16}px; top: {panY + hoveredNode.y * zoom - 24}px;"
    >
      <span class="font-semibold text-white text-sm">{hoveredNode.title}</span>
      <div class="flex items-center gap-2 text-[11px] text-white/60">
        <span class="flex items-center gap-1">
          <span class="size-2 rounded-full" style="background-color: {hoveredNode.color}"></span>
          {hoveredNode.listTitle}
        </span>
        <span>•</span>
        <span>{hoveredNode.connections} tautan</span>
      </div>
      <span class="text-[10px] text-indigo-400 mt-1">Klik untuk membuka catatan</span>
    </div>
  {/if}
</div>
