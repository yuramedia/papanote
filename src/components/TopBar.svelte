<script lang="ts">
  import LogOut from '@lucide/svelte/icons/log-out';
  import StickyNote from '@lucide/svelte/icons/sticky-note';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import type { Snippet } from 'svelte';

  let { title = '', children }: { title?: string; children?: Snippet } = $props();
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
    <span class="hidden text-sm text-white/60 sm:inline">{auth.user?.email}</span>
    <button
      class="btn text-white/80 hover:bg-white/10 hover:text-white"
      onclick={() => auth.signOut()}
      title="Keluar"
    >
      <LogOut class="size-4" />
    </button>
  </div>
</header>
