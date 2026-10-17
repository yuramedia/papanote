<script lang="ts">
  import { onMount } from 'svelte';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Send from '@lucide/svelte/icons/send';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import AtSign from '@lucide/svelte/icons/at-sign';
  import Smile from '@lucide/svelte/icons/smile';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import User from '@lucide/svelte/icons/user';
  import {
    fetchCardComments,
    addCardComment,
    deleteCardComment,
    updateCommentReactionsDb,
    extractMentions,
    filterMentionSuggestions,
    formatCommentHtml,
    toggleCommentReaction,
    type MentionMember,
  } from '../lib/comments';
  import { formatDeletedRelativeTime } from '../lib/trash';
  import { auth } from '../lib/auth.svelte';
  import { supabase } from '../lib/supabase';
  import { toast } from '../lib/toast.svelte';
  import type { CardComment } from '../lib/types';

  let {
    cardId,
    cardTitle,
    boardId,
  }: {
    cardId: string;
    cardTitle: string;
    boardId?: string;
  } = $props();

  let comments = $state<CardComment[]>([]);
  let loading = $state(true);
  let submitting = $state(false);
  let commentText = $state('');
  let teamMembers = $state<MentionMember[]>([]);
  let textareaEl = $state<HTMLTextAreaElement | null>(null);

  // Status Autocomplete @mention
  let showMentionMenu = $state(false);
  let mentionQuery = $state('');
  let mentionCursorPos = $state(0);
  let selectedMentionIdx = $state(0);

  // Palet emoji cepat
  const QUICK_EMOJIS = ['👍', '❤️', '🎉', '🚀', '👀', '💡'];

  onMount(async () => {
    await loadTeamMembers();
  });

  $effect(() => {
    const currentCardId = cardId;
    loadComments(currentCardId);

    const ch = supabase()
      .channel(`card_comments:${currentCardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'card_comments', filter: `card_id=eq.${currentCardId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newComment = payload.new as CardComment;
            if (!comments.some((c) => c.id === newComment.id)) {
              comments = [...comments, newComment];
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as CardComment;
            comments = comments.map((c) => (c.id === updated.id ? updated : c));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string })?.id;
            if (deletedId) {
              comments = comments.filter((c) => c.id !== deletedId);
            }
          }
        },
      )
      .subscribe();

    return () => {
      ch.unsubscribe();
    };
  });

  async function loadComments(targetId: string = cardId) {
    loading = true;
    try {
      comments = await fetchCardComments(targetId);
    } catch (err) {
      console.warn('Gagal memuat komentar:', err);
    } finally {
      loading = false;
    }
  }

  async function loadTeamMembers() {
    try {
      const { data, error } = await supabase().rpc('get_team_members');
      if (!error && Array.isArray(data)) {
        teamMembers = (data as { id: string; email: string; username?: string }[]).map((u) => ({
          id: u.id,
          email: u.email,
          username: u.username || (u.email ? u.email.split('@')[0] : 'user'),
        }));
      } else if (auth.user) {
        teamMembers = [
          {
            id: auth.user.id,
            email: auth.user.email ?? '',
            username: auth.username || 'Anda',
          },
        ];
      }
    } catch {
      if (auth.user) {
        teamMembers = [
          {
            id: auth.user.id,
            email: auth.user.email ?? '',
            username: auth.username || 'Anda',
          },
        ];
      }
    }
  }

  // Filter saran @mention
  const filteredMembers = $derived(filterMentionSuggestions(teamMembers, mentionQuery));

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    commentText = target.value;
    const pos = target.selectionStart;
    mentionCursorPos = pos;

    // Cek apakah kursor berada tepat setelah tanda @
    const textBeforeCursor = commentText.slice(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1 && (lastAtIndex === 0 || /\s/.test(textBeforeCursor[lastAtIndex - 1]))) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      if (!/\s/.test(query)) {
        mentionQuery = query;
        showMentionMenu = true;
        selectedMentionIdx = 0;
        return;
      }
    }

    showMentionMenu = false;
  }

  function insertMention(username: string) {
    const textBeforeCursor = commentText.slice(0, mentionCursorPos);
    const textAfterCursor = commentText.slice(mentionCursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const beforeAt = textBeforeCursor.slice(0, lastAtIndex);
      commentText = `${beforeAt}@${username} ${textAfterCursor}`;
    } else {
      commentText += `@${username} `;
    }

    showMentionMenu = false;
    if (textareaEl) {
      textareaEl.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (showMentionMenu && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedMentionIdx = (selectedMentionIdx + 1) % filteredMembers.length;
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedMentionIdx = (selectedMentionIdx - 1 + filteredMembers.length) % filteredMembers.length;
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredMembers[selectedMentionIdx];
        if (selected) {
          insertMention(selected.username);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        showMentionMenu = false;
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmitComment();
    }
  }

  async function handleSubmitComment() {
    const text = commentText.trim();
    if (!text || submitting) return;

    if (!auth.user) {
      toast.show('Silakan login terlebih dahulu untuk berkomentar.', 'info');
      return;
    }

    submitting = true;
    try {
      const mentions = extractMentions(text);
      const newComment = await addCardComment(cardId, text, {
        id: auth.user.id,
        username: auth.username || 'user',
        email: auth.user.email,
      });

      // Tambahkan ke state lokal jika belum ter-merge oleh realtime
      if (!comments.some((c) => c.id === newComment.id)) {
        comments = [...comments, newComment];
      }

      commentText = '';
      showMentionMenu = false;

      if (mentions.length > 0) {
        toast.success(`Komentar terkirim dengan sebutan ke @${mentions.join(', @')}.`);
      } else {
        toast.success('Komentar berhasil dikirim.');
      }
    } catch (err) {
      toast.error('Gagal mengirim komentar: ' + (err as Error).message);
    } finally {
      submitting = false;
    }
  }

  async function handleDeleteComment(comment: CardComment) {
    try {
      const ok = await deleteCardComment(comment.id, cardId);
      if (ok) {
        comments = comments.filter((c) => c.id !== comment.id);
        toast.show('Komentar telah dihapus.', 'info');
      }
    } catch (err) {
      toast.error('Gagal menghapus komentar: ' + (err as Error).message);
    }
  }

  async function handleToggleReaction(comment: CardComment, emoji: string) {
    if (!auth.user) return;
    const updatedReactions = toggleCommentReaction(comment.reactions, emoji, auth.user.id);
    comment.reactions = updatedReactions;
    comments = [...comments];

    await updateCommentReactionsDb(comment.id, cardId, updatedReactions);
  }

  // Warna avatar acak yang konsisten berdasarkan nama user
  function getAvatarGradient(name: string): string {
    const gradients = [
      'from-indigo-500 to-purple-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
      'from-sky-500 to-blue-600',
      'from-fuchsia-500 to-rose-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
  }
</script>

<div class="mt-6 border-t border-slate-200/80 pt-5">
  <!-- 1. Header Bagian Komentar -->
  <div class="flex items-center justify-between gap-2 mb-3">
    <div class="flex items-center gap-2">
      <div class="grid size-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60">
        <MessageSquare class="size-4" />
      </div>
      <h3 class="text-sm font-semibold text-slate-800">Diskusi &amp; Komentar Tim</h3>
      <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        {comments.length}
      </span>
    </div>
    <span class="text-[11px] text-slate-400 hidden sm:inline">
      Ketik <code>@</code> untuk menyebut anggota tim
    </span>
  </div>

  <!-- 2. Daftar Komentar -->
  <div class="space-y-3 mb-4">
    {#if loading}
      <div class="flex items-center justify-center py-6 text-xs text-slate-400 gap-2">
        <LoaderCircle class="size-4 animate-spin text-indigo-500" />
        <span>Memuat diskusi...</span>
      </div>
    {:else if comments.length === 0}
      <div class="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center text-xs text-slate-400">
        <MessageSquare class="mx-auto size-6 text-slate-300 mb-1.5" />
        <p class="font-medium text-slate-600">Belum ada komentar pada kartu ini</p>
        <p class="text-[11px] text-slate-400 mt-0.5">
          Tulis catatan progres, diskusikan pertanyaan, atau sebut anggota tim menggunakan <code class="font-mono text-indigo-600">@username</code>.
        </p>
      </div>
    {:else}
      {#each comments as comment (comment.id)}
        {@const isAuthor = auth.user?.id === comment.user_id}
        {@const canDelete = isAuthor || auth.isAdmin}

        <div class="group relative rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-all hover:border-slate-300">
          <div class="flex items-start justify-between gap-2">
            <!-- Info Pengguna & Timestamp -->
            <div class="flex items-center gap-2">
              <div class="grid size-7 place-items-center rounded-full bg-gradient-to-br {getAvatarGradient(comment.user_name)} text-[11px] font-bold text-white shadow-2xs">
                {comment.user_name.slice(0, 1).toUpperCase()}
              </div>
              <div class="flex flex-wrap items-center gap-1.5 text-xs">
                <span class="font-semibold text-slate-800 truncate">@{comment.user_name}</span>
                {#if isAuthor}
                  <span class="rounded bg-indigo-50 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-600 border border-indigo-200/60">
                    Anda
                  </span>
                {/if}
                <span class="text-slate-400 text-[11px]">• {formatDeletedRelativeTime(comment.created_at)}</span>
              </div>
            </div>

            <!-- Tombol Hapus Komentar -->
            {#if canDelete}
              <button
                type="button"
                onclick={() => handleDeleteComment(comment)}
                class="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Hapus komentar ini"
              >
                <Trash2 class="size-3.5" />
              </button>
            {/if}
          </div>

          <!-- Isi Komentar (Markdown & Mentions) -->
          <div class="mt-2 text-xs text-slate-700 leading-relaxed break-words font-sans pl-9">
            {@html formatCommentHtml(comment.content, auth.username)}
          </div>

          <!-- Bar Reaksi Emoji & Tombol Cepat -->
          <div class="mt-2.5 flex flex-wrap items-center gap-1 pl-9">
            {#if comment.reactions && Object.keys(comment.reactions).length > 0}
              {#each Object.entries(comment.reactions) as [emoji, userIds] (emoji)}
                {@const hasReacted = auth.user ? userIds.includes(auth.user.id) : false}
                <button
                  type="button"
                  onclick={() => handleToggleReaction(comment, emoji)}
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition cursor-pointer {hasReacted
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}"
                  title={`${userIds.length} orang bereaksi dengan ${emoji}`}
                >
                  <span>{emoji}</span>
                  <span class="text-[10px] font-mono">{userIds.length}</span>
                </button>
              {/each}
            {/if}

            <!-- Tombol Tambah Reaksi Cepat -->
            <div class="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              {#each QUICK_EMOJIS.slice(0, 3) as quickEmoji}
                <button
                  type="button"
                  onclick={() => handleToggleReaction(comment, quickEmoji)}
                  class="rounded-md p-1 text-xs hover:bg-slate-100 hover:scale-110 transition cursor-pointer"
                  title={`Beri reaksi ${quickEmoji}`}
                >
                  {quickEmoji}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- 3. Form Input Komentar Baru -->
  <div class="relative rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
    <textarea
      bind:this={textareaEl}
      value={commentText}
      oninput={handleInput}
      onkeydown={handleKeyDown}
      placeholder="Tulis tanggapan atau sebut @anggota tim... (Ctrl + Enter untuk kirim)"
      rows="2"
      class="w-full resize-none bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none leading-relaxed"
    ></textarea>

    <!-- Dropdown Autocomplete @mention -->
    {#if showMentionMenu && filteredMembers.length > 0}
      <div
        class="absolute bottom-full left-2 z-50 mb-1 max-h-48 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xl animate-in fade-in-0 duration-100"
      >
        <div class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
          Pilih Anggota Tim
        </div>
        {#each filteredMembers as member, idx (member.id)}
          {@const isSelected = idx === selectedMentionIdx}
          <button
            type="button"
            onclick={() => insertMention(member.username)}
            class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition cursor-pointer {isSelected
              ? 'bg-indigo-600 text-white font-medium'
              : 'text-slate-700 hover:bg-slate-100'}"
          >
            <div class="grid size-5 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
              {member.username.slice(0, 1).toUpperCase()}
            </div>
            <div class="min-w-0 flex-1 truncate">
              <span class="font-semibold">@{member.username}</span>
              {#if member.email}
                <span class="ml-1 text-[10px] opacity-75 truncate">{member.email}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Toolbar Bawah Input: Tombol @, Emojis, & Kirim -->
    <div class="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
      <div class="flex items-center gap-1 text-slate-500">
        <!-- Tombol Tambah Mention -->
        <button
          type="button"
          onclick={() => {
            commentText += '@';
            showMentionMenu = true;
            mentionQuery = '';
            textareaEl?.focus();
          }}
          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
          title="Sebut anggota tim (@mention)"
        >
          <AtSign class="size-3.5 text-indigo-500" />
          <span class="text-[11px] hidden sm:inline">Mention</span>
        </button>

        <!-- Quick Emojis -->
        <div class="hidden sm:flex items-center gap-0.5 ml-1">
          {#each QUICK_EMOJIS as emo}
            <button
              type="button"
              onclick={() => {
                commentText += emo;
                textareaEl?.focus();
              }}
              class="rounded p-1 text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              {emo}
            </button>
          {/each}
        </div>
      </div>

      <!-- Tombol Kirim -->
      <button
        type="button"
        onclick={handleSubmitComment}
        disabled={!commentText.trim() || submitting}
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition cursor-pointer shadow-2xs"
      >
        {#if submitting}
          <LoaderCircle class="size-3.5 animate-spin" />
        {:else}
          <Send class="size-3.5" />
        {/if}
        <span>Kirim</span>
      </button>
    </div>
  </div>
</div>
