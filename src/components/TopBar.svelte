<script lang="ts">
  import LogOut from '@lucide/svelte/icons/log-out';
  import StickyNote from '@lucide/svelte/icons/sticky-note';
  import Users from '@lucide/svelte/icons/users';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import AdminUsersDialog from './AdminUsersDialog.svelte';
  import ChangePasswordDialog from './ChangePasswordDialog.svelte';
  import type { Snippet } from 'svelte';

  let { title = '', children }: { title?: string; children?: Snippet } = $props();
  let openAdmin = $state(false);
  let openChangePassword = $state(false);
</script>

<header class="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-slate-900 px-4 text-white">
  <button class="flex items-center gap-2 font-semibold tracking-tight" onclick={() => router.go('/')}>
    <span class="grid size-8 place-items-center rounded-lg bg-white/10"><StickyNote class="size-4" /></span>
    papanote
  </button>
  {#if title}
    <span class="text-white/30">/</span>
    <h1 class="truncate font-medium">{title}</h1>
  {/if}
  <div class="ml-auto flex items-center gap-2">
    {@render children?.()}
    {#if auth.isAdmin}
      <button
        class="btn bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-colors cursor-pointer"
        onclick={() => (openAdmin = true)}
        title="Kelola Pengguna Tim"
      >
        <Users class="size-3.5 text-amber-400" />
        <span class="hidden sm:inline">Kelola User</span>
      </button>
    {/if}
    <button
      class="btn bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-colors cursor-pointer"
      onclick={() => (openChangePassword = true)}
      title="Ganti Password"
    >
      <KeyRound class="size-3.5 text-indigo-400" />
      <span class="hidden sm:inline">Ganti Password</span>
    </button>
    <span class="hidden text-sm text-white/60 md:inline">{auth.user?.email}</span>
    <button
      class="btn text-white/80 hover:bg-white/10 hover:text-white"
      onclick={() => auth.signOut()}
      title="Keluar"
    >
      <LogOut class="size-4" />
    </button>
  </div>
</header>

<AdminUsersDialog bind:open={openAdmin} />
<ChangePasswordDialog bind:open={openChangePassword} />
