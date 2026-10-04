<script lang="ts">
  import StickyNote from '@lucide/svelte/icons/sticky-note';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { auth } from '../lib/auth.svelte';

  let email = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let submitting = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    submitting = true;
    error = await auth.signIn(email.trim(), password);
    submitting = false;
  }
</script>

<main class="grid min-h-full place-items-center bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 p-4">
  <div class="w-full max-w-sm">
    <div class="mb-6 flex items-center justify-center gap-2 text-white">
      <span class="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
        <StickyNote class="size-5" />
      </span>
      <span class="text-2xl font-semibold tracking-tight">papanote</span>
    </div>

    <form onsubmit={submit} class="rounded-2xl bg-white p-6 shadow-2xl">
      <h1 class="text-lg font-semibold text-slate-900">Masuk</h1>
      <p class="mt-1 text-sm text-slate-500">Gunakan akun yang diberikan oleh Admin.</p>

      <label class="mt-5 block text-sm font-medium text-slate-700" for="email">Email</label>
      <input id="email" class="input mt-1" type="email" autocomplete="username" required bind:value={email} />

      <label class="mt-4 block text-sm font-medium text-slate-700" for="password">Password</label>
      <input
        id="password"
        class="input mt-1"
        type="password"
        autocomplete="current-password"
        required
        bind:value={password}
      />

      {#if error}
        <p class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>
      {/if}

      <button class="btn-primary mt-5 w-full py-2" type="submit" disabled={submitting}>
        {#if submitting}<LoaderCircle class="size-4 animate-spin" />{/if}
        Masuk
      </button>

      <p class="mt-4 text-center text-xs text-slate-400">Belum punya akun? Hubungi Admin.</p>
    </form>
  </div>
</main>
