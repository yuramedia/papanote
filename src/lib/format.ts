const TZ = 'Asia/Jakarta';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}

export type DeadlineState = 'none' | 'normal' | 'soon' | 'overdue';

export function deadlineState(iso: string | null, now = Date.now()): DeadlineState {
  if (!iso) return 'none';
  const diff = new Date(iso).getTime() - now;
  if (diff < 0) return 'overdue';
  if (diff <= 24 * 60 * 60 * 1000) return 'soon';
  return 'normal';
}

/** ISO → nilai untuk <input type="datetime-local"> (waktu lokal browser). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Nilai <input type="datetime-local"> → ISO UTC (null jika kosong). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'baru saja';
}
