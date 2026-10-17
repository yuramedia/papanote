import { supabase } from './supabase';
import type { CardComment } from './types';

export interface MentionMember {
  id: string;
  username: string;
  email?: string;
}

const LOCAL_COMMENTS_KEY = 'papanote_card_comments';

function getLocalStore(): Record<string, CardComment[]> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalStore(store: Record<string, CardComment[]>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(store));
  } catch {
    // Abaikan jika quota terlampaui
  }
}

export function loadLocalComments(cardId: string): CardComment[] {
  const store = getLocalStore();
  return store[cardId] ?? [];
}

export function saveLocalComment(comment: CardComment): void {
  const store = getLocalStore();
  const list = store[comment.card_id] ?? [];
  const idx = list.findIndex((c) => c.id === comment.id);
  if (idx !== -1) {
    list[idx] = comment;
  } else {
    list.push(comment);
  }
  store[comment.card_id] = list;
  setLocalStore(store);
}

export function deleteLocalComment(commentId: string, cardId: string): void {
  const store = getLocalStore();
  const list = store[cardId] ?? [];
  store[cardId] = list.filter((c) => c.id !== commentId);
  setLocalStore(store);
}

export function updateLocalCommentReactions(
  commentId: string,
  cardId: string,
  reactions: Record<string, string[]>,
): void {
  const store = getLocalStore();
  const list = store[cardId] ?? [];
  const item = list.find((c) => c.id === commentId);
  if (item) {
    item.reactions = reactions;
    item.updated_at = new Date().toISOString();
    setLocalStore(store);
  }
}

/**
 * Ekstraksi semua sebutan @username dari teks komentar.
 * Mengembalikan array username tanpa simbol '@' dalam huruf kecil unik.
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/@([a-zA-Z0-9_.-]+)/g);
  if (!matches) return [];
  const list = matches.map((m) => m.slice(1).toLowerCase());
  return Array.from(new Set(list));
}

/**
 * Filter daftar saran anggota tim berdasarkan query sebutan (@query).
 */
export function filterMentionSuggestions(
  members: MentionMember[],
  query: string,
): MentionMember[] {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  if (!q) return members;
  return members.filter(
    (m) =>
      m.username.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)),
  );
}

/**
 * Render teks komentar menjadi HTML dengan badge @mention yang disorot dan tautan URL otomatis.
 */
export function formatCommentHtml(content: string, currentUsername?: string): string {
  if (!content) return '';

  // Escaping dasar untuk keamanan XSS
  let safe = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Gantikan @username dengan mention chip
  safe = safe.replace(/@([a-zA-Z0-9_.-]+)/g, (_, username) => {
    const isMe =
      currentUsername && username.toLowerCase() === currentUsername.toLowerCase();
    const styleClass = isMe
      ? 'bg-amber-400/25 text-amber-700 font-semibold px-1.5 py-0.5 rounded border border-amber-300'
      : 'bg-indigo-50 text-indigo-600 font-semibold px-1.5 py-0.5 rounded border border-indigo-200';
    return `<span class="inline-flex items-center gap-0.5 ${styleClass}">@${username}</span>`;
  });

  // Gantikan baris baru menjadi <br />
  safe = safe.replace(/\n/g, '<br />');

  return safe;
}

/**
 * Toggle reaksi emoji pada komentar.
 */
export function toggleCommentReaction(
  reactions: Record<string, string[]> | undefined,
  emoji: string,
  userId: string,
): Record<string, string[]> {
  const current = { ...(reactions || {}) };
  const userList = current[emoji] ? [...current[emoji]] : [];
  const idx = userList.indexOf(userId);

  if (idx !== -1) {
    userList.splice(idx, 1);
  } else {
    userList.push(userId);
  }

  if (userList.length === 0) {
    delete current[emoji];
  } else {
    current[emoji] = userList;
  }

  return current;
}

/**
 * Mengambil daftar komentar untuk suatu kartu (Supabase dengan fallback lokal).
 */
export async function fetchCardComments(cardId: string): Promise<CardComment[]> {
  const sb = supabase();
  try {
    const { data, error } = await sb
      .from('card_comments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      return data as CardComment[];
    }
  } catch (err) {
    console.warn('Gagal memuat komentar dari server, beralih ke cache lokal:', err);
  }

  return loadLocalComments(cardId);
}

/**
 * Menambahkan komentar baru ke kartu.
 */
export async function addCardComment(
  cardId: string,
  content: string,
  user: { id: string; username: string; email?: string },
): Promise<CardComment> {
  const comment: CardComment = {
    id: crypto.randomUUID(),
    card_id: cardId,
    user_id: user.id,
    user_name: user.username,
    user_email: user.email || null,
    content,
    reactions: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sb = supabase();
  try {
    const { error } = await sb.from('card_comments').insert({
      id: comment.id,
      card_id: comment.card_id,
      user_id: comment.user_id,
      user_name: comment.user_name,
      user_email: comment.user_email,
      content: comment.content,
      reactions: comment.reactions,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
    });
    if (!error) return comment;
  } catch (err) {
    console.warn('Gagal menyimpan komentar ke Supabase, menyimpan di cache lokal:', err);
  }

  saveLocalComment(comment);
  return comment;
}

/**
 * Menghapus komentar dari kartu.
 */
export async function deleteCardComment(commentId: string, cardId: string): Promise<boolean> {
  const sb = supabase();
  try {
    const { error } = await sb.from('card_comments').delete().eq('id', commentId);
    if (!error) return true;
  } catch {
    // Fallback
  }
  deleteLocalComment(commentId, cardId);
  return true;
}

/**
 * Memperbarui reaksi emoji komentar di database.
 */
export async function updateCommentReactionsDb(
  commentId: string,
  cardId: string,
  reactions: Record<string, string[]>,
): Promise<boolean> {
  const sb = supabase();
  try {
    const { error } = await sb
      .from('card_comments')
      .update({ reactions, updated_at: new Date().toISOString() })
      .eq('id', commentId);
    if (!error) return true;
  } catch {
    // Fallback
  }
  updateLocalCommentReactions(commentId, cardId, reactions);
  return true;
}
