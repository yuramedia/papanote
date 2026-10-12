import type { Card, List } from './types';
import { extractTags } from './tags';

export interface SearchMatchSegment {
  text: string;
  isMatch: boolean;
}

export interface SearchCardResult {
  card: Card;
  score: number;
  matchedField: 'title' | 'content' | 'tag';
  titleSegments: SearchMatchSegment[];
  snippetSegments: SearchMatchSegment[] | null;
  snippetText: string | null;
  listTitle: string;
  tags: string[];
}

/**
 * Memecah teks menjadi segmen match dan non-match untuk rendering highlight teks.
 */
export function highlightSegments(text: string, query: string): SearchMatchSegment[] {
  if (!text) return [];
  const q = query.trim();
  if (!q) return [{ text, isMatch: false }];

  const regex = new RegExp(`(${escapeRegex(q)})`, 'gi');
  const parts = text.split(regex);
  const lowerQ = q.toLowerCase();

  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      isMatch: part.toLowerCase() === lowerQ,
    }));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Membersihkan syntax markdown dasar dari teks sebelum membuat snippet.
 */
function cleanMarkdownForSnippet(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' [kode] ')
    .replace(/`[^`\n]*`/g, (m) => m.slice(1, -1))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mengambil cuplikan kalimat (snippet) di sekitar query yang cocok.
 */
export function extractSnippet(content: string, query: string, maxLen = 85): string | null {
  if (!content) return null;
  const cleaned = cleanMarkdownForSnippet(content);
  const q = query.trim().toLowerCase();
  if (!q) {
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.slice(0, maxLen).trim() + '…';
  }

  const idx = cleaned.toLowerCase().indexOf(q);
  if (idx === -1) return null;

  const leadLen = Math.floor((maxLen - q.length) / 2);
  let start = Math.max(0, idx - leadLen);
  let end = Math.min(cleaned.length, start + maxLen);

  if (start > 0) {
    const spaceBefore = cleaned.indexOf(' ', start);
    if (spaceBefore !== -1 && spaceBefore < idx) {
      start = spaceBefore + 1;
    }
  }

  if (end < cleaned.length) {
    const spaceAfter = cleaned.lastIndexOf(' ', end);
    if (spaceAfter > idx + q.length) {
      end = spaceAfter;
    }
  }

  let snippet = cleaned.slice(start, end).trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < cleaned.length) snippet = snippet + '…';

  return snippet;
}

/**
 * Melakukan deep-search teks penuh di seluruh kartu (judul, isi markdown, dan tagar).
 * Mengembalikan hasil terurut berdasarkan skor relevansi:
 * 1. Judul persis / diawali query (skor tertinggi)
 * 2. Judul memuat query
 * 3. Tagar memuat query
 * 4. Badan isi markdown memuat query
 */
export function searchCards(cards: Card[], query: string, lists: List[]): SearchCardResult[] {
  const active = cards.filter((c) => !c.deleted_at);
  const q = query.trim().toLowerCase();

  const listMap = new Map<string, string>();
  for (const l of lists) {
    listMap.set(l.id, l.title);
  }

  if (!q) {
    // Tanpa query, kembalikan daftar terbaru
    return active.slice(0, 15).map((card) => {
      const tags = extractTags(card.content);
      const snippet = extractSnippet(card.content, '');
      return {
        card,
        score: 0,
        matchedField: 'title',
        titleSegments: [{ text: card.title, isMatch: false }],
        snippetSegments: snippet ? [{ text: snippet, isMatch: false }] : null,
        snippetText: snippet,
        listTitle: listMap.get(card.list_id) ?? 'List',
        tags,
      };
    });
  }

  const results: SearchCardResult[] = [];

  for (const card of active) {
    const titleLower = card.title.toLowerCase();
    const content = card.content || '';
    const contentLower = content.toLowerCase();
    const tags = extractTags(content);

    let score = 0;
    let matchedField: 'title' | 'content' | 'tag' = 'title';
    let snippetText: string | null = null;

    const titleExact = titleLower === q;
    const titleStarts = titleLower.startsWith(q);
    const titleIncludes = titleLower.includes(q);
    const tagMatch = tags.some((t) => t.includes(q) || `#${t}`.includes(q));
    const contentIncludes = contentLower.includes(q);

    if (titleExact) {
      score += 100;
      matchedField = 'title';
    } else if (titleStarts) {
      score += 75;
      matchedField = 'title';
    } else if (titleIncludes) {
      score += 50;
      matchedField = 'title';
    }

    if (tagMatch) {
      score += 35;
      if (score === 35) matchedField = 'tag';
    }

    if (contentIncludes) {
      score += 20;
      if (score === 20) matchedField = 'content';
      snippetText = extractSnippet(content, q);
    } else if (!snippetText && content) {
      snippetText = extractSnippet(content, '');
    }

    if (score > 0) {
      results.push({
        card,
        score,
        matchedField,
        titleSegments: highlightSegments(card.title, q),
        snippetSegments: snippetText ? highlightSegments(snippetText, q) : null,
        snippetText,
        listTitle: listMap.get(card.list_id) ?? 'List',
        tags,
      });
    }
  }

  // Urutkan berdasarkan relevansi (skor terbesar ke terkecil)
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, 20);
}
