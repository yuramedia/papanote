<script lang="ts">
  import { Dialog } from 'bits-ui';
  import X from '@lucide/svelte/icons/x';
  import Globe from '@lucide/svelte/icons/globe';
  import Lock from '@lucide/svelte/icons/lock';
  import Users from '@lucide/svelte/icons/users';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Check from '@lucide/svelte/icons/check';
  import Search from '@lucide/svelte/icons/search';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import AlertCircle from '@lucide/svelte/icons/alert-circle';
  import UserCheck from '@lucide/svelte/icons/user-check';
  import { supabase } from '../lib/supabase';
  import { auth } from '../lib/auth.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { Board, BoardVisibility } from '../lib/types';

  let {
    board,
    open = $bindable(false),
    onsave,
  }: {
    board: Board | null;
    open?: boolean;
    onsave: (boardId: string, patch: { visibility: BoardVisibility; member_ids: string[] }) => Promise<void>;
  } = $props();

  interface TeamMember {
    id: string;
    email: string;
  }

  let selectedVisibility = $state<BoardVisibility>('public');
  let selectedMembers = $state<string[]>([]);
  let teamMembers = $state<TeamMember[]>([]);
  let loadingMembers = $state(false);
  let memberSearch = $state('');
  let saving = $state(false);
  let loadError = $state<string | null>(null);

  // Inisialisasi form setiap kali modal dibuka atau board berganti
  $effect(() => {
    if (open && board) {
      selectedVisibility = board.visibility || 'public';
      selectedMembers = Array.isArray(board.member_ids) ? [...board.member_ids] : [];
      memberSearch = '';
      loadTeamMembers();
    }
  });

  async function loadTeamMembers() {
    loadingMembers = true;
    loadError = null;
    try {
      // Coba panggil get_team_members RPC (bisa diakses semua authenticated user)
      const { data, error } = await supabase().rpc('get_team_members');
      if (!error && data && Array.isArray(data)) {
        teamMembers = data as TeamMember[];
      } else {
        // Fallback jika get_team_members belum dibuat: coba admin_list_users (jika user admin)
        if (auth.isAdmin) {
          const { data: adminData, error: adminErr } = await supabase().rpc('admin_list_users');
          if (!adminErr && adminData) {
            teamMembers = (adminData as { id: string; email: string }[]).map((u) => ({
              id: u.id,
              email: u.email,
            }));
            return;
          }
        }

        // Jika fungsi RPC belum di-deploy di Supabase, set fallback default dengan pengguna saat ini
        if (auth.user) {
          teamMembers = [{ id: auth.user.id, email: auth.user.email ?? 'Anda' }];
        }
      }
    } catch {
      if (auth.user) {
        teamMembers = [{ id: auth.user.id, email: auth.user.email ?? 'Anda' }];
      }
    } finally {
      loadingMembers = false;
    }
  }

  const filteredMembers = $derived.by(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((m) => m.email.toLowerCase().includes(q));
  });

  function toggleMember(memberIdOrEmail: string) {
    if (selectedMembers.includes(memberIdOrEmail)) {
      selectedMembers = selectedMembers.filter((id) => id !== memberIdOrEmail);
    } else {
      selectedMembers = [...selectedMembers, memberIdOrEmail];
    }
  }

  async function handleSave() {
    if (!board) return;
    saving = true;

    // Pastikan pembuat papan selalu ada di daftar member jika kustom
    let finalMembers = [...selectedMembers];
    if (board.created_by && !finalMembers.includes(board.created_by)) {
      finalMembers.push(board.created_by);
    }

    try {
      await onsave(board.id, {
        visibility: selectedVisibility,
        member_ids: selectedVisibility === 'members' ? finalMembers : [],
      });
      open = false;
      toast.success('Pengaturan visibilitas papan berhasil disimpan.');
    } catch (err) {
      toast.error('Gagal menyimpan visibilitas: ' + (err as Error).message);
    } finally {
      saving = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="modal-overlay" />
    <Dialog.Content class="modal-card max-w-lg p-6 max-h-[90vh] overflow-y-auto">
      <!-- Header Dialog -->
      <div class="flex items-start justify-between border-b border-slate-100 pb-4">
        <div class="flex items-center gap-2.5">
          <div class="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <ShieldCheck class="size-5" />
          </div>
          <div>
            <Dialog.Title class="text-base font-semibold text-slate-900">
              Akses & Visibilitas Papan
            </Dialog.Title>
            <Dialog.Description class="text-xs text-slate-500">
              Atur siapa saja yang dapat melihat dan membuka papan <strong>"{board?.title ?? ''}"</strong>.
            </Dialog.Description>
          </div>
        </div>
        <Dialog.Close class="modal-close">
          <X class="size-4" />
        </Dialog.Close>
      </div>

      <!-- Opsi Pilihan Visibilitas -->
      <div class="mt-4 space-y-3">
        <!-- 1. Semua Tim (Publik) -->
        <label
          class="flex items-start gap-3 rounded-xl border p-3.5 transition cursor-pointer {selectedVisibility === 'public'
            ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
            : 'border-slate-200 hover:border-slate-300 bg-white'}"
        >
          <input
            type="radio"
            name="board-visibility"
            value="public"
            checked={selectedVisibility === 'public'}
            onchange={() => (selectedVisibility = 'public')}
            class="mt-1 size-4 text-indigo-600 accent-indigo-600"
          />
          <div class="flex-1">
            <div class="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
              <Globe class="size-3.5 text-emerald-600" />
              <span>Semua Anggota Tim (Publik)</span>
            </div>
            <p class="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Semua anggota tim yang terdaftar dan login dapat melihat, membuka, dan mengedit catatan di papan ini.
            </p>
          </div>
        </label>

        <!-- 2. Pribadi (Hanya Pemilik & Admin) -->
        <label
          class="flex items-start gap-3 rounded-xl border p-3.5 transition cursor-pointer {selectedVisibility === 'private'
            ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
            : 'border-slate-200 hover:border-slate-300 bg-white'}"
        >
          <input
            type="radio"
            name="board-visibility"
            value="private"
            checked={selectedVisibility === 'private'}
            onchange={() => (selectedVisibility = 'private')}
            class="mt-1 size-4 text-indigo-600 accent-indigo-600"
          />
          <div class="flex-1">
            <div class="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
              <Lock class="size-3.5 text-amber-600" />
              <span>Pribadi (Hanya Saya)</span>
            </div>
            <p class="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Hanya Anda sebagai pembuat papan (dan Admin tim) yang dapat melihat dan mengakses papan ini. Anggota lain tidak akan melihatnya di daftar papan.
            </p>
          </div>
        </label>

        <!-- 3. Anggota Tertentu (Kustom) -->
        <label
          class="flex items-start gap-3 rounded-xl border p-3.5 transition cursor-pointer {selectedVisibility === 'members'
            ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
            : 'border-slate-200 hover:border-slate-300 bg-white'}"
        >
          <input
            type="radio"
            name="board-visibility"
            value="members"
            checked={selectedVisibility === 'members'}
            onchange={() => (selectedVisibility = 'members')}
            class="mt-1 size-4 text-indigo-600 accent-indigo-600"
          />
          <div class="flex-1">
            <div class="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
              <Users class="size-3.5 text-indigo-600" />
              <span>Anggota Tim Tertentu</span>
            </div>
            <p class="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Hanya rekan tim yang Anda pilih secara spesifik di bawah yang diizinkan melihat dan berkolaborasi di papan ini.
            </p>
          </div>
        </label>
      </div>

      <!-- Area Pemilihan Anggota (Saat 'members' dipilih) -->
      {#if selectedVisibility === 'members'}
        <div class="mt-4 rounded-xl border border-indigo-200 bg-slate-50/80 p-3.5 animate-in fade-in-0 duration-150">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <UserCheck class="size-3.5 text-indigo-600" />
              <span>Pilih Anggota yang Diberi Akses</span>
            </span>
            <span class="text-[11px] text-slate-500 font-medium">
              {selectedMembers.length} anggota terpilih
            </span>
          </div>

          <!-- Input Search Anggota -->
          <div class="relative mb-2.5">
            <Search class="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari anggota tim berdasarkan email…"
              bind:value={memberSearch}
              class="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <!-- List User Checklist -->
          <div class="max-h-48 overflow-y-auto space-y-1 pr-1">
            {#if loadingMembers}
              <div class="flex items-center justify-center py-6 text-xs text-slate-400">
                <LoaderCircle class="size-4 animate-spin mr-2 text-indigo-600" />
                Memuat daftar anggota tim…
              </div>
            {:else if filteredMembers.length === 0}
              <p class="py-4 text-center text-xs text-slate-400">
                Tidak ada anggota tim yang cocok dengan "{memberSearch}".
              </p>
            {:else}
              {#each filteredMembers as member (member.id)}
                {@const isOwner = board?.created_by === member.id}
                {@const isSelected = isOwner || selectedMembers.includes(member.id) || selectedMembers.includes(member.email.toLowerCase())}

                <label
                  class="flex items-center justify-between rounded-lg px-2.5 py-1.5 transition cursor-pointer {isSelected
                    ? 'bg-indigo-100/70 text-slate-900 font-medium'
                    : 'hover:bg-slate-200/60 text-slate-700'}"
                >
                  <div class="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isOwner}
                      onchange={() => toggleMember(member.id)}
                      class="size-3.5 text-indigo-600 accent-indigo-600 rounded cursor-pointer disabled:opacity-50"
                    />
                    <span class="text-xs truncate">{member.email}</span>
                  </div>

                  {#if isOwner}
                    <span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                      Pemilik
                    </span>
                  {:else if isSelected}
                    <span class="text-[10px] text-indigo-600 shrink-0 font-medium">
                      Akses Diberikan
                    </span>
                  {/if}
                </label>
              {/each}
            {/if}
          </div>
        </div>
      {/if}

      <!-- Footer Tombol -->
      <div class="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          class="btn text-slate-600 hover:bg-slate-100"
          onclick={() => (open = false)}
          disabled={saving}
        >
          Batal
        </button>
        <button
          type="button"
          class="btn-primary"
          onclick={handleSave}
          disabled={saving}
        >
          {#if saving}
            <LoaderCircle class="size-3.5 animate-spin mr-1.5" />
            Menyimpan…
          {:else}
            <Check class="size-3.5 mr-1.5" />
            Simpan Visibilitas
          {/if}
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
