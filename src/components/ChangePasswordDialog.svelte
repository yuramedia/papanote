<script lang="ts">
  import { Dialog } from 'bits-ui';
  import X from '@lucide/svelte/icons/x';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Dices from '@lucide/svelte/icons/dices';
  import { auth } from '../lib/auth.svelte';
  import { toast } from '../lib/toast.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  let newPassword = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = 'Yura-';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    newPassword = res;
    confirmPassword = res;
    showPassword = true;
  }

  $effect(() => {
    if (open) {
      newPassword = '';
      confirmPassword = '';
      showPassword = false;
      formError = null;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    formError = null;

    if (!newPassword || newPassword.length < 6) {
      formError = 'Password baru minimal 6 karakter.';
      return;
    }

    if (newPassword !== confirmPassword) {
      formError = 'Konfirmasi password tidak cocok.';
      return;
    }

    submitting = true;
    try {
      const err = await auth.updatePassword(newPassword);
      if (err) {
        formError = err;
      } else {
        toast.success('Password berhasil diperbarui.');
        open = false;
      }
    } catch (err) {
      formError = (err as Error).message || 'Gagal mengubah password.';
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200" />
    <Dialog.Content
      class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
    >
      <div class="flex items-center justify-between border-b border-white/10 pb-4">
        <div class="flex items-center gap-2.5">
          <div class="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <KeyRound class="size-5" />
          </div>
          <div>
            <Dialog.Title class="text-base font-semibold text-white">Ganti Password</Dialog.Title>
            <Dialog.Description class="text-xs text-white/50">
              Perbarui kata sandi akun Anda ({auth.user?.email})
            </Dialog.Description>
          </div>
        </div>
        <Dialog.Close
          class="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <X class="size-4" />
        </Dialog.Close>
      </div>

      <form onsubmit={handleSubmit} class="mt-4 space-y-4">
        {#if formError}
          <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {formError}
          </div>
        {/if}

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="new-pw" class="text-xs font-medium text-white/80">Password Baru</label>
            <button
              type="button"
              onclick={generateRandomPassword}
              class="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
            >
              <Dices class="size-3" />
              <span>Acak Password</span>
            </button>
          </div>
          <div class="relative">
            <input
              id="new-pw"
              type={showPassword ? 'text' : 'password'}
              bind:value={newPassword}
              placeholder="Minimal 6 karakter"
              required
              minlength="6"
              class="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 pr-10 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
              title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
            >
              {#if showPassword}
                <EyeOff class="size-4" />
              {:else}
                <Eye class="size-4" />
              {/if}
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label for="confirm-pw" class="text-xs font-medium text-white/80">Konfirmasi Password Baru</label>
          <input
            id="confirm-pw"
            type={showPassword ? 'text' : 'password'}
            bind:value={confirmPassword}
            placeholder="Ketik ulang password baru"
            required
            minlength="6"
            class="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onclick={() => (open = false)}
            class="rounded-xl px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            class="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {#if submitting}
              <LoaderCircle class="size-3.5 animate-spin" />
              <span>Menyimpan...</span>
            {:else}
              <span>Simpan Password</span>
            {/if}
          </button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
