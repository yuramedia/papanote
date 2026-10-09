<script lang="ts">
  import { Dialog } from 'bits-ui';
  import X from '@lucide/svelte/icons/x';
  import Users from '@lucide/svelte/icons/users';
  import UserPlus from '@lucide/svelte/icons/user-plus';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Dices from '@lucide/svelte/icons/dices';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { supabase } from '../lib/supabase';
  import { toast } from '../lib/toast.svelte';
  import { formatDateTime } from '../lib/format';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  interface AdminUser {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
  }

  let users = $state<AdminUser[]>([]);
  let loadingList = $state(false);

  let newEmail = $state('');
  let newPassword = $state('');
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = 'Yura-';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    newPassword = res;
  }

  async function loadUsers() {
    loadingList = true;
    try {
      const { data, error } = await supabase().rpc('admin_list_users');
      if (error) {
        toast.error('Gagal memuat daftar pengguna: ' + error.message);
      } else {
        users = (data as AdminUser[]) ?? [];
      }
    } catch (err) {
      toast.error('Gagal mengambil daftar pengguna: ' + (err as Error).message);
    } finally {
      loadingList = false;
    }
  }

  $effect(() => {
    if (open) {
      formError = null;
      loadUsers();
    }
  });

  async function handleCreateUser(e: SubmitEvent) {
    e.preventDefault();
    formError = null;

    const email = newEmail.trim().toLowerCase();
    const password = newPassword.trim();

    if (!email || !email.includes('@')) {
      formError = 'Masukkan alamat email yang valid.';
      return;
    }
    if (!password || password.length < 6) {
      formError = 'Password harus minimal 6 karakter.';
      return;
    }

    submitting = true;
    try {
      const { data, error } = await supabase().rpc('admin_create_user', {
        new_email: email,
        new_password: password,
      });

      if (error) {
        formError = error.message;
        toast.error(error.message);
      } else {
        toast.success(`Akun ${email} berhasil dibuat!`);
        newEmail = '';
        newPassword = '';
        await loadUsers();
      }
    } catch (err) {
      const msg = (err as Error).message;
      formError = msg;
      toast.error(msg);
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
    >
      <div class="flex items-center justify-between border-b border-slate-100 pb-4">
        <div class="flex items-center gap-2.5">
          <span class="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Users class="size-5" />
          </span>
          <div>
            <Dialog.Title class="text-lg font-semibold text-slate-900">
              Kelola Pengguna Tim
            </Dialog.Title>
            <p class="text-xs text-slate-500">
              Tambah akun baru untuk anggota tim dan tinjau pengguna yang terdaftar.
            </p>
          </div>
        </div>
        <Dialog.Close class="btn-ghost p-1.5 text-slate-400 hover:text-slate-600">
          <X class="size-5" />
        </Dialog.Close>
      </div>

      <!-- Form Tambah Akun Baru -->
      <section class="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
        <div class="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <UserPlus class="size-4 text-brand-600" />
          <span>Tambah Akun Baru</span>
        </div>

        <form onsubmit={handleCreateUser} class="mt-3.5 space-y-3">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-xs font-medium text-slate-700" for="new-email">
                Alamat Email
              </label>
              <input
                id="new-email"
                type="email"
                required
                placeholder="nama@yuramedia.com"
                class="input mt-1 w-full bg-white text-sm"
                bind:value={newEmail}
              />
            </div>

            <div>
              <div class="flex items-center justify-between">
                <label class="block text-xs font-medium text-slate-700" for="new-password">
                  Password
                </label>
                <button
                  type="button"
                  class="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
                  onclick={generateRandomPassword}
                >
                  <Dices class="size-3" />
                  Acak Password
                </button>
              </div>
              <input
                id="new-password"
                type="text"
                required
                placeholder="Minimal 6 karakter"
                class="input mt-1 w-full bg-white text-sm font-mono"
                bind:value={newPassword}
              />
            </div>
          </div>

          {#if formError}
            <p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </p>
          {/if}

          <div class="flex justify-end pt-1">
            <button
              type="submit"
              class="btn-primary text-xs py-2 px-4 shadow-sm"
              disabled={submitting}
            >
              {#if submitting}
                <LoaderCircle class="size-3.5 animate-spin" />
              {:else}
                <UserPlus class="size-3.5" />
              {/if}
              Buat Akun Anggota
            </button>
          </div>
        </form>
      </section>

      <!-- Daftar Pengguna Terdaftar -->
      <section class="mt-6">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold text-slate-800">
              Pengguna Terdaftar ({users.length})
            </h3>
            {#if loadingList}
              <LoaderCircle class="size-3.5 animate-spin text-slate-400" />
            {/if}
          </div>
          <button
            type="button"
            class="btn-ghost flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
            onclick={loadUsers}
            disabled={loadingList}
            title="Segarkan daftar pengguna"
          >
            <RefreshCw class="size-3 {loadingList ? 'animate-spin' : ''}" />
            Refresh
          </button>
        </div>

        {#if users.length === 0 && !loadingList}
          <p class="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Belum ada data pengguna.
          </p>
        {:else}
          <div class="overflow-hidden rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th class="py-2.5 px-3">Email Pengguna</th>
                  <th class="py-2.5 px-3">Terdaftar</th>
                  <th class="py-2.5 px-3">Terakhir Login</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-700">
                {#each users as u (u.id)}
                  <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-2.5 px-3 font-medium flex items-center gap-2">
                      {#if u.email === 'admin@yuramedia.com'}
                        <span class="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-600/20">
                          <ShieldCheck class="size-3" />
                          Admin
                        </span>
                      {/if}
                      <span>{u.email}</span>
                    </td>
                    <td class="py-2.5 px-3 text-slate-500">
                      {formatDateTime(u.created_at)}
                    </td>
                    <td class="py-2.5 px-3 text-slate-500">
                      {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'Belum pernah'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
