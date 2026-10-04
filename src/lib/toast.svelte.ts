export type ToastKind = 'info' | 'success' | 'error';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

class ToastStore {
  items = $state<Toast[]>([]);
  #seq = 0;

  show(message: string, kind: ToastKind = 'info', ms = 3500) {
    const id = ++this.#seq;
    this.items.push({ id, kind, message });
    setTimeout(() => this.dismiss(id), ms);
  }
  success(m: string) {
    this.show(m, 'success');
  }
  error(m: string) {
    this.show(m, 'error', 6000);
  }
  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();
