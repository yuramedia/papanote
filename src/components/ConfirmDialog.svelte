<script lang="ts">
  import { AlertDialog } from 'bits-ui';

  let {
    open = $bindable(false),
    title,
    description,
    confirmLabel = 'Hapus',
    onconfirm,
  }: {
    open?: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onconfirm: () => void;
  } = $props();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" />
    <AlertDialog.Content
      class="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl"
    >
      <AlertDialog.Title class="text-base font-semibold text-slate-900">{title}</AlertDialog.Title>
      <AlertDialog.Description class="mt-2 text-sm text-slate-600">{description}</AlertDialog.Description>
      <div class="mt-5 flex justify-end gap-2">
        <AlertDialog.Cancel class="btn-ghost">Batal</AlertDialog.Cancel>
        <AlertDialog.Action
          class="btn-danger"
          onclick={() => {
            open = false;
            onconfirm();
          }}>{confirmLabel}</AlertDialog.Action
        >
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
