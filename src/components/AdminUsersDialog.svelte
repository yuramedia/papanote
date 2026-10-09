<script lang="ts">
  import { Dialog } from 'bits-ui';
  import X from '@lucide/svelte/icons/x';
  import Users from '@lucide/svelte/icons/users';
  import UserPlus from '@lucide/svelte/icons/user-plus';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Dices from '@lucide/svelte/icons/dices';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import UserCheck from '@lucide/svelte/icons/user-check';
  import { supabase } from '../lib/supabase';
  import { toast } from '../lib/toast.svelte';
  import { auth } from '../lib/auth.svelte';
  import { formatDateTime } from '../lib/format';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  interface AdminUser {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    is_admin: boolean;
  }

  let users = $state<AdminUser[]>([]);
  let loadingList = $state(false);

  let newEmail = $state('');
  let newPassword = $state('');
  let makeAdmin = $state(false);
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  let changingRole = $state<string | null>(null);

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
        make_admin: makeAdmin,
      });

      if (error) {
        formError = error.message;
        toast.error(error.message);
      } else {
        toast.success(
          makeAdmin
            ? `Akun Admin baru (${email}) berhasil dibuat!`
            : `Akun anggota (${email}) berhasil dibuat!`
        );
        newEmail = '';
        newPassword = '';
        makeAdmin = false;
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

  async function handleToggleRole(targetEmail: string, currentIsAdmin: boolean) {
    changingRole = targetEmail;
    try {
      const nextIsAdmin = !currentIsAdmin;
      const { error } = await supabase().rpc('admin_set_role', {
        target_email: targetEmail,
        make_admin: nextIsAdmin,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(
          nextIsAdmin
            ? `Berhasil memberikan hak akses Admin kepada ${targetEmail}`
            : `Hak akses Admin untuk ${targetEmail} telah dicabut.`
        );
        await loadUsers();
        await auth.checkAdmin();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      changingRole = null;
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
              Kelola Pengguna & Hak Akses
            </Dialog.Title>
            <p class="text-xs text-slate-500">
              Tambah akun anggota baru, atur role Admin, dan pantau status tim.
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
                  class="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 cursor-pointer"
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

          <div class="flex items-center justify-between pt-1">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                class="rounded border-slate-300 text-brand-600 focus:ring-brand-500 size-4 cursor-pointer"
                bind:checked={makeAdmin}
              />
              <span class="text-xs font-medium text-slate-700">
                Berikan Hak Akses Admin (Multi-Admin)
              </span>
            </label>

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
              Buat Akun
            </button>
          </div>

          {#if formError}
            <p class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </p>
          {/if}
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
                  <th class="py-2.5 px-3">Role</th>
                  <th class="py-2.5 px-3 hidden sm:table-cell">Terdaftar</th>
                  <th class="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-700">
                {#each users as u (u.id)}
                  <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-2.5 px-3 font-medium">
                      <span>{u.email}</span>
                      <div class="text-[10px] text-slate-400 sm:hidden">
                        Masuk: {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'Belum pernah'}
                      </div>
                    </td>
                    <td class="py-2.5 px-3">
                      {#if u.is_admin}
                        <span class="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-600/20">
                          <ShieldCheck class="size-3" />
                          Admin
                        </span>
                      {:else}
                        <span class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <UserCheck class="size-3 text-slate-400" />
                          Anggota
                        </span>
                      {/if}
                    </td>
                    <td class="py-2.5 px-3 text-slate-500 hidden sm:table-cell">
                      {formatDateTime(u.created_at)}
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      {#if u.email === 'admin@yuramedia.com'}
                        <span class="text-[11px] text-slate-400 italic">Root Admin</span>
                      {:else}
                        <button
                          type="button"
                          class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer {u.is_admin
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800'}"
                          disabled={changingRole === u.email}
                          onclick={() => handleToggleRole(u.email, u.is_admin)}
                          title={u.is_admin ? 'Cabut hak akses admin' : 'Jadikan admin'}
                        >
                          {#if changingRole === u.email}
                            <LoaderCircle class="size-3 animate-spin" />
                          {:else if u.is_admin}
                            <ShieldAlert class="size-3" />
                            Cabut Admin
                          {:else}
                            <ShieldCheck class="size-3" />
                            Jadikan Admin
                          {/if}
                        </button>
                      {/if}
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
