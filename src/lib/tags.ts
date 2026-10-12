import type { Card } from './types';

export interface TagStyle {
  bg: string;
  text: string;
  border: string;
  badge: string;
  dotHex: string;
}

const PALETTE: TagStyle[] = [
  {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    dotHex: '#6366f1',
  },
  {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    dotHex: '#10b981',
  },
  {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
    dotHex: '#f59e0b',
  },
  {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    badge: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
    dotHex: '#f43f5e',
  },
  {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    badge: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
    dotHex: '#0ea5e9',
  },
  {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    dotHex: '#a855f7',
  },
  {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    dotHex: '#f97316',
  },
  {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    badge: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
    dotHex: '#14b8a6',
  },
  {
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
    badge: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100',
    dotHex: '#ec4899',
  },
  {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
    dotHex: '#06b6d4',
  },
  {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    badge: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
    dotHex: '#8b5cf6',
  },
  {
    bg: 'bg-lime-50',
    text: 'text-lime-700',
    border: 'border-lime-200',
    badge: 'bg-lime-50 text-lime-700 border-lime-200 hover:bg-lime-100',
    dotHex: '#84cc16',
  },
];

const SEMANTIC_TAGS: Record<string, number> = {
  urgent: 3, // Rose
  darurat: 3,
  bug: 3,
  error: 3,
  hotfix: 3,
  p0: 3,
  done: 1, // Emerald
  selesai: 1,
  success: 1,
  p3: 1,
  wip: 2, // Amber
  todo: 2,
  'in-progress': 2,
  review: 2,
  p1: 2,
  warning: 2,
  idea: 4, // Sky
  ide: 4,
  feature: 4,
  p2: 4,
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Mengambil styling warna yang konsisten untuk sebuah tag.
 */
export function getTagColor(tag: string): TagStyle {
  const normalized = tag.toLowerCase().replace(/^#/, '');
  if (normalized in SEMANTIC_TAGS) {
    return PALETTE[SEMANTIC_TAGS[normalized]];
  }
  const idx = hashString(normalized) % PALETTE.length;
  return PALETTE[idx];
}

/**
 * Mengekstrak seluruh tagar (#tag) unik dari teks markdown kartu.
 * Mengabaikan heading (# Judul), hex color (#ffffff, #38bdf8), anchor link,
 * dan blok kode (code blocks ``` dan inline code `).
 */
export function extractTags(content: string | null | undefined): string[] {
  if (!content) return [];

  // 1. Bersihkan code blocks ```...``` dan inline code `...`
  const cleaned = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    // 2. Bersihkan markdown links [text](url) agar anchor # di dalam url tidak terambil
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1 ');

  // 3. Regex matching tags
  // Awalan: awal baris, spasi, atau tanda kurung/kutip buka
  // Body: diawali huruf atau angka, bisa mengandung huruf, angka, _, -, /
  // Akhiran: akhir baris, spasi, atau tanda baca tutup
  const tagRegex = /(?:^|[\s([{"'<])#([a-zA-Z0-9_\-\/]+)(?=[\s)\]}"'>,.;:!?]|$)/g;
  const matches = cleaned.matchAll(tagRegex);
  const tagsSet = new Set<string>();

  for (const match of matches) {
    const rawTag = match[1];

    // Syarat 1: Tidak boleh hanya berupa angka murni (misal #123)
    if (/^\d+$/.test(rawTag)) continue;

    // Syarat 2: Tidak boleh berakhiran atau berawalan simbol pembatas / - _
    if (/^[\/\-_]|[\/\-_]$/.test(rawTag)) continue;

    // Syarat 3: Tidak boleh memiliki garis miring ganda //
    if (rawTag.includes('//')) continue;

    // Syarat 4: Bukan hex color murni (3, 6, atau 8 digit a-f 0-9)
    if (/^[0-9a-fA-F]{3}$/.test(rawTag) || /^[0-9a-fA-F]{6}$/.test(rawTag) || /^[0-9a-fA-F]{8}$/.test(rawTag)) {
      continue;
    }

    // Normalisasi tag ke huruf kecil untuk konsistensi pencarian & pengelompokan
    tagsSet.add(rawTag.toLowerCase());
  }

  return Array.from(tagsSet).sort();
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Mengambil daftar seluruh tag unik beserta jumlah kemunculannya di kartu.
 * Diurutkan berdasarkan jumlah terbanyak, lalu nama secara alfabetis.
 */
export function getAllTagsWithCount(cards: Card[]): TagCount[] {
  const map = new Map<string, number>();

  for (const card of cards) {
    if (card.deleted_at) continue;
    const tags = extractTags(card.content);
    for (const t of tags) {
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }

  const result: TagCount[] = Array.from(map.entries()).map(([tag, count]) => ({
    tag,
    count,
  }));

  result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });

  return result;
}

/**
 * Memfilter daftar kartu berdasarkan tagar aktif.
 * Jika activeTags kosong, mengembalikan seluruh kartu.
 * Kartu lolos jika memiliki SEMUA tag yang ada di activeTags.
 */
export function filterCardsByTags(cards: Card[], activeTags: string[]): Card[] {
  if (!activeTags || activeTags.length === 0) return cards;
  const lowerActive = activeTags.map((t) => t.toLowerCase().replace(/^#/, ''));

  return cards.filter((card) => {
    const cardTags = extractTags(card.content);
    return lowerActive.every((t) => cardTags.includes(t));
  });
}
