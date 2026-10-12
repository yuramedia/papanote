/**
 * Modul logika dan utilitas untuk Sistem Pomodoro & Focus Timer Papanote.
 */

export type PomodoroMode = 'focus' | 'short_break' | 'long_break';
export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface PomodoroSession {
  timestamp: string;
  durationMinutes: number;
  mode: PomodoroMode;
  cardId?: string;
  cardTitle?: string;
}

export const MODE_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,       // 25 menit
  short_break: 5 * 60,  // 5 menit
  long_break: 15 * 60,  // 15 menit
};

export const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: 'Fokus Kerja',
  short_break: 'Istirahat Singkat',
  long_break: 'Istirahat Panjang',
};

export const MODE_ICONS: Record<PomodoroMode, string> = {
  focus: '🍅',
  short_break: '☕',
  long_break: '🛋️',
};

/**
 * Memformat sisa detik menjadi format menit:detik (contoh: 25:00, 04:30)
 */
export function formatPomodoroTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Menghitung persentase progres (0 - 100%)
 */
export function calculateProgress(remainingSeconds: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 0;
  const elapsed = totalSeconds - Math.max(0, remainingSeconds);
  const percent = (elapsed / totalSeconds) * 100;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/**
 * Menghasilkan teks markdown log sesi fokus untuk disisipkan ke dalam catatan
 */
export function formatSessionLogMarkdown(options: {
  durationMinutes: number;
  date?: Date;
  mode?: PomodoroMode;
}): string {
  const d = options.date ?? new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${mins} WIB`;
  const icon = options.mode ? MODE_ICONS[options.mode] : '🍅';
  const label = options.mode ? MODE_LABELS[options.mode] : 'Sesi Fokus';

  return `> ${icon} **${label}:** ${options.durationMinutes} menit (${dateStr} ${timeStr})`;
}

/**
 * Membunyikan chime audio menggunakan Web Audio API tanpa perlu aset eksternal.
 * Menghasilkan nada lembut yang menyenangkan saat sesi selesai atau dimulai.
 */
export function playChimeSound(type: 'complete' | 'start' | 'tick' = 'complete'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'complete') {
      // Nada tiga akor naik (C5 - E5 - G5) ala lonceng zen
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.65);
      });
    } else if (type === 'start') {
      // Nada pendek dua nada awal
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.26);
    }
  } catch {
    // Abaikan jika browser membatasi autoplay audio
  }
}

/**
 * Menampilkan notifikasi browser saat sesi pomodoro selesai
 */
export function sendTimerNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    } catch {
      // fallback
    }
  }
}
