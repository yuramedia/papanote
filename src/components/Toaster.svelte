<script lang="ts">
  import { toast } from '../lib/toast.svelte';
  import { fly } from 'svelte/transition';

  const styles = {
    info: 'bg-slate-900 text-white',
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
  } as const;
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col gap-2" aria-live="polite">
  {#each toast.items as t (t.id)}
    <button
      transition:fly={{ y: 12, duration: 180 }}
      class="pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-left text-sm shadow-lg {styles[t.kind]}"
      onclick={() => toast.dismiss(t.id)}
    >
      {t.message}
    </button>
  {/each}
</div>
