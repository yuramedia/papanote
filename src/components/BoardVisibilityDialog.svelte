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
  import UserPlus from '@lucide/svelte/icons/user-plus';
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
    onsave: (
      boardId: string,
      patch: { visibility: BoardVisibility; member_ids: string[]; member_roles: Record<string, 'admin' | 'user'> }
    ) => Promise<void>;
  } = $props();

  interface TeamMember {
    id: string;
    email: string;
    username?: string;
  }

  let selectedVisibility = $state<BoardVisibility>('public');
  let selectedMembers = $state<string[]>([]);
  let selectedRoles = $state<Record<string, 'admin' | 'user'>>({});
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
      selectedRoles = board.member_roles ? { ...board.member_roles } : {};
      memberSearch = '';
      loadTeamMembers();
    }
  });

  async function loadTeamMembers() {
    loadingMembers = true;
    loadError = null;
    try {
      const { data, error } = await supabase().rpc('get_team_members');
      if (!error && data && Array.isArray(data)) {
        teamMembers = (data as TeamMember[]).map((u) => ({
          id: u.id,
          email: u.email,
          username: u.username || (u.email ? u.email.split('@')[0] : ''),
        }));
      } else {
        if (auth.isAdmin) {
          const { data: adminData, error: adminErr } = await supabase().rpc('admin_list_users');
          if (!adminErr && adminData) {
            teamMembers = (adminData as { id: string; email: string; username?: string }[]).map((u) => ({
              id: u.id,
              email: u.email,
              username: u.username || (u.email ? u.email.split('@')[0] : ''),
            }));
            return;
          }
        }

        if (auth.user) {
          teamMembers = [
            {
              id: auth.user.id,
              email: auth.user.email ?? 'Anda',
              username: auth.username || (auth.user.email ? auth.user.email.split('@')[0] : 'Anda'),
            },
          ];
        }
      }
    } catch {
      if (auth.user) {
        teamMembers = [
          {
            id: auth.user.id,
            email: auth.user.email ?? 'Anda',
            username: auth.username || (auth.user.email ? auth.user.email.split('@')[0] : 'Anda'),
          },
        ];
      }
    } finally {
      loadingMembers = false;
    }
  }

  // Filter anggota tim berdasarkan email ATAU username
  const filteredMembers = $derived.by(() => {
    const q = memberSearch.trim().toLowerCase().replace(/^@/, '');
    if (!q) return teamMembers;
    return teamMembers.filter((m) => {
      const email = m.email.toLowerCase();
      const uname = (m.username || m.email.split('@')[0]).toLowerCase();
      return email.includes(q) || uname.includes(q);
    });
  });

  // Anggota kustom yang ditambahkan manual via username/email yang tidak cocok dengan ID akun terdaftar
  const customSelectedMembers = $derived.by(() => {
    const knownIds = new Set(teamMembers.map((m) => m.id));
    const knownEmails = new Set(teamMembers.map((m) => m.email.toLowerCase()));
    const knownUsernames = new Set(teamMembers.map((m) => (m.username || m.email.split('@')[0]).toLowerCase()));

    return selectedMembers.filter((sm) => {
      const clean = sm.toLowerCase().replace(/^@/, '');
      return !knownIds.has(sm) && !knownEmails.has(clean) && !knownUsernames.has(clean) && board?.created_by !== sm;
    });
  });

  function isMemberSelected(member: TeamMember): boolean {
    if (board?.created_by === member.id) return true;
    const uname = (member.username || member.email.split('@')[0]).toLowerCase();
    const email = member.email.toLowerCase();
    return selectedMembers.some((sm) => {
      const clean = sm.toLowerCase().replace(/^@/, '');
      return sm === member.id || clean === email || clean === uname;
    });
  }

  function toggleMember(member: TeamMember) {
    const uname = (member.username || member.email.split('@')[0]).toLowerCase();
    const email = member.email.toLowerCase();
    const isSelected = isMemberSelected(member);

    if (isSelected) {
      selectedMembers = selectedMembers.filter((sm) => {
        const clean = sm.toLowerCase().replace(/^@/, '');
        return sm !== member.id && clean !== email && clean !== uname;
      });
      const copy = { ...selectedRoles };
      delete copy[member.id];
      delete copy[email];
      delete copy[uname];
      delete copy[`@${uname}`];
      selectedRoles = copy;
    } else {
      selectedMembers = [...selectedMembers, member.id];
      if (!selectedRoles[member.id]) {
        selectedRoles = { ...selectedRoles, [member.id]: 'user' };
      }
    }
  }

  function getMemberRole(member: TeamMember): 'admin' | 'user' {
    const uname = (member.username || member.email.split('@')[0]).toLowerCase();
    const email = member.email.toLowerCase();
    return (
      selectedRoles[member.id] ||
      selectedRoles[email] ||
      selectedRoles[uname] ||
      selectedRoles[`@${uname}`] ||
      'user'
    );
  }

  function setMemberRole(member: TeamMember, role: 'admin' | 'user') {
    selectedRoles = { ...selectedRoles, [member.id]: role };
  }

  function addManualMember() {
    const input = memberSearch.trim();
    if (!input) return;
    const clean = input.toLowerCase();
    const cleanNoAt = clean.replace(/^@/, '');

    // Cek apakah cocok dengan anggota yang sudah dikenal
    const match = teamMembers.find(
      (m) =>
        m.email.toLowerCase() === clean ||
        (m.username && m.username.toLowerCase() === cleanNoAt) ||
        m.email.split('@')[0].toLowerCase() === cleanNoAt
    );

    const identifierToAdd = match ? match.id : input;
    if (!selectedMembers.includes(identifierToAdd)) {
      selectedMembers = [...selectedMembers, identifierToAdd];
      if (!selectedRoles[identifierToAdd]) {
        selectedRoles = { ...selectedRoles, [identifierToAdd]: 'user' };
      }
      toast.success(`Akses untuk "${input}" berhasil ditambahkan.`);
    } else {
      toast.info(`"${input}" sudah ada di daftar akses.`);
    }
    memberSearch = '';
  }

  function removeCustomMember(customItem: string) {
    selectedMembers = selectedMembers.filter((sm) => sm !== customItem);
    const copy = { ...selectedRoles };
    delete copy[customItem];
    selectedRoles = copy;
  }

  function setCustomMemberRole(customItem: string, role: 'admin' | 'user') {
    selectedRoles = { ...selectedRoles, [customItem]: role };
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
        member_roles: selectedVisibility === 'members' ? selectedRoles : {},
      });
      open = false;
      toast.success('Pengaturan hak akses papan berhasil disimpan.');
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

          <!-- Input Search & Tambah Anggota -->
          <div class="relative mb-2.5">
            <Search class="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari atau ketik username / email…"
              bind:value={memberSearch}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addManualMember();
                }
              }}
              class="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-18 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
            {#if memberSearch.trim()}
              <button
                type="button"
                onclick={addManualMember}
                class="absolute right-1 top-1 bottom-1 px-2 text-[10px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition flex items-center gap-1 cursor-pointer"
                title="Beri akses sesuai username atau email yang diketik"
              >
                <UserPlus class="size-3" />
                Tambah
              </button>
            {/if}
          </div>

          <!-- List User Checklist -->
          <div class="max-h-48 overflow-y-auto space-y-1 pr-1">
            {#if loadingMembers}
              <div class="flex items-center justify-center py-6 text-xs text-slate-400">
                <LoaderCircle class="size-4 animate-spin mr-2 text-indigo-600" />
                Memuat daftar anggota tim…
              </div>
            {:else if filteredMembers.length === 0 && customSelectedMembers.length === 0}
              <div class="py-4 text-center text-xs text-slate-400 space-y-1.5">
                <p>Tidak ada anggota tim yang cocok dengan "{memberSearch}".</p>
                {#if memberSearch.trim()}
                  <button
                    type="button"
                    onclick={addManualMember}
                    class="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                  >
                    <UserPlus class="size-3" />
                    Beri akses ke "{memberSearch.trim()}" sekarang
                  </button>
                {/if}
              </div>
            {:else}
              {#each filteredMembers as member (member.id)}
                {@const isOwner = board?.created_by === member.id}
                {@const isSelected = isOwner || isMemberSelected(member)}

                <div
                  class="flex items-center justify-between rounded-lg px-2.5 py-1.5 transition {isSelected
                    ? 'bg-indigo-50/90 text-slate-900 font-medium'
                    : 'hover:bg-slate-100 text-slate-700'}"
                >
                  <label class="flex items-center gap-2 truncate cursor-pointer flex-1 mr-2 select-none">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isOwner}
                      onchange={() => toggleMember(member)}
                      class="size-3.5 text-indigo-600 accent-indigo-600 rounded cursor-pointer disabled:opacity-50"
                    />
                    <div class="flex flex-col min-w-0">
                      <span class="text-xs font-semibold text-slate-800 truncate">
                        @{member.username || member.email.split('@')[0]}
                      </span>
                      <span class="text-[11px] text-slate-500 truncate">{member.email}</span>
                    </div>
                  </label>

                  {#if isOwner}
                    <span class="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 shrink-0">
                      👑 Owner
                    </span>
                  {:else if isSelected}
                    <div class="flex items-center gap-1.5 shrink-0">
                      <select
                        value={getMemberRole(member)}
                        onchange={(e) => setMemberRole(member, e.currentTarget.value as 'admin' | 'user')}
                        class="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                        title="Peran anggota di papan ini"
                      >
                        <option value="admin">🛡️ Admin</option>
                        <option value="user">👤 User</option>
                      </select>
                    </div>
                  {:else}
                    <span class="text-[10px] text-slate-400 shrink-0">
                      Tidak ada akses
                    </span>
                  {/if}
                </div>
              {/each}

              {#if customSelectedMembers.length > 0}
                <div class="mt-2.5 border-t border-indigo-200/60 pt-2 space-y-1">
                  <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    Akses Khusus (Username / Email Manual)
                  </div>
                  {#each customSelectedMembers as customItem (customItem)}
                    <div
                      class="flex items-center justify-between rounded-lg bg-indigo-50/90 px-2.5 py-1.5 text-slate-900"
                    >
                      <div class="flex items-center gap-2 truncate flex-1 mr-2">
                        <button
                          type="button"
                          onclick={() => removeCustomMember(customItem)}
                          class="text-slate-400 hover:text-rose-600 transition p-0.5 rounded cursor-pointer"
                          title="Hapus akses"
                        >
                          <X class="size-3.5" />
                        </button>
                        <span class="text-xs font-semibold text-slate-800 truncate">
                          {customItem.startsWith('@') || customItem.includes('@') ? customItem : `@${customItem}`}
                        </span>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <select
                          value={selectedRoles[customItem] || 'user'}
                          onchange={(e) => setCustomMemberRole(customItem, e.currentTarget.value as 'admin' | 'user')}
                          class="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                          title="Peran anggota di papan ini"
                        >
                          <option value="admin">🛡️ Admin</option>
                          <option value="user">👤 User</option>
                        </select>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
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
