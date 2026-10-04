<script lang="ts">
  /** Teks yang bisa diklik untuk diedit; tersimpan otomatis saat blur atau Enter. */
  let {
    value,
    onsave,
    class: klass = '',
    inputClass = '',
    placeholder = '',
  }: {
    value: string;
    onsave: (v: string) => void;
    class?: string;
    inputClass?: string;
    placeholder?: string;
  } = $props();

  let editing = $state(false);
  let draft = $state('');
  let input = $state<HTMLInputElement | null>(null);

  function start() {
    draft = value;
    editing = true;
    queueMicrotask(() => input?.select());
  }
  function commit() {
    editing = false;
    const v = draft.trim();
    if (v && v !== value) onsave(v);
  }
</script>

{#if editing}
  <input
    bind:this={input}
    bind:value={draft}
    class="input py-1 {inputClass}"
    {placeholder}
    onblur={commit}
    onkeydown={(e) => {
      if (e.key === 'Enter') input?.blur();
      if (e.key === 'Escape') {
        draft = value;
        editing = false;
      }
    }}
  />
{:else}
  <button class="cursor-text truncate text-left {klass}" onclick={start} title="Klik untuk mengubah">{value}</button>
{/if}
