import {
  MODE_DURATIONS,
  formatPomodoroTime,
  calculateProgress,
  formatSessionLogMarkdown,
  playChimeSound,
  sendTimerNotification,
  type PomodoroMode,
  type PomodoroStatus,
} from './pomodoro';
import type { BoardStore } from './board.svelte';
import { toast } from './toast.svelte';

class PomodoroStore {
  status = $state<PomodoroStatus>('idle');
  mode = $state<PomodoroMode>('focus');
  remainingSeconds = $state<number>(MODE_DURATIONS.focus);
  totalSeconds = $state<number>(MODE_DURATIONS.focus);
  cardId = $state<string | null>(null);
  cardTitle = $state<string | null>(null);
  completedPomodoros = $state<number>(0);
  soundEnabled = $state<boolean>(true);

  private intervalId: number | null = null;

  formattedTime = $derived(formatPomodoroTime(this.remainingSeconds));
  progress = $derived(calculateProgress(this.remainingSeconds, this.totalSeconds));
  isRunning = $derived(this.status === 'running');
  isPaused = $derived(this.status === 'paused');
  isCompleted = $derived(this.status === 'completed');

  constructor() {
    // Request permission untuk browser notification jika belum pernah
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }

  /**
   * Mulai timer (dengan atau tanpa kartu target)
   */
  start(targetCardId?: string, targetCardTitle?: string) {
    if (targetCardId) {
      this.cardId = targetCardId;
      this.cardTitle = targetCardTitle ?? 'Catatan Aktif';
    }

    if (this.status === 'idle' || this.status === 'completed') {
      this.totalSeconds = MODE_DURATIONS[this.mode];
      this.remainingSeconds = this.totalSeconds;
    }

    this.status = 'running';
    if (this.soundEnabled) {
      playChimeSound('start');
    }

    this.clearInterval();
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Jeda timer
   */
  pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.clearInterval();
  }

  /**
   * Lanjutkan timer dari kondisi jeda
   */
  resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.clearInterval();
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Toggle Play / Pause
   */
  toggle(targetCardId?: string, targetCardTitle?: string) {
    if (this.status === 'running') {
      this.pause();
    } else if (this.status === 'paused') {
      this.resume();
    } else {
      this.start(targetCardId, targetCardTitle);
    }
  }

  /**
   * Reset timer ke awal
   */
  reset() {
    this.clearInterval();
    this.status = 'idle';
    this.remainingSeconds = MODE_DURATIONS[this.mode];
    this.totalSeconds = this.remainingSeconds;
  }

  /**
   * Ganti mode (Fokus, Istirahat Singkat, Istirahat Panjang)
   */
  switchMode(newMode: PomodoroMode) {
    this.clearInterval();
    this.mode = newMode;
    this.status = 'idle';
    this.remainingSeconds = MODE_DURATIONS[newMode];
    this.totalSeconds = this.remainingSeconds;
  }

  /**
   * Pasang kartu fokus ke timer yang sedang berjalan
   */
  attachCard(cardId: string, cardTitle: string) {
    this.cardId = cardId;
    this.cardTitle = cardTitle;
  }

  /**
   * Lepas kartu fokus
   */
  detachCard() {
    this.cardId = null;
    this.cardTitle = null;
  }

  /**
   * Detik berkurang
   */
  private tick() {
    if (this.remainingSeconds > 0) {
      this.remainingSeconds--;
    }

    if (this.remainingSeconds <= 0) {
      this.handleComplete();
    }
  }

  /**
   * Waktu habis / sesi selesai
   */
  private handleComplete() {
    this.clearInterval();
    this.status = 'completed';

    if (this.soundEnabled) {
      playChimeSound('complete');
    }

    if (this.mode === 'focus') {
      this.completedPomodoros++;
      const title = '🍅 Sesi Fokus Selesai!';
      const body = this.cardTitle
        ? `Kerja bagus untuk "${this.cardTitle}"! Waktunya istirahat 5 menit.`
        : 'Kerja bagus! Waktunya istirahat 5 menit sejenak.';
      sendTimerNotification(title, body);
      toast.success(title);
    } else {
      const title = '☕ Waktu Istirahat Berakhir!';
      const body = 'Siap untuk melanjutkan fokus kerja berikutnya?';
      sendTimerNotification(title, body);
      toast.show(title, 'info');
    }
  }

  /**
   * Catat sesi fokus yang selesai ke dalam isi markdown kartu
   */
  async logSessionToCard(store: BoardStore, specificCardId?: string): Promise<boolean> {
    const targetId = specificCardId || this.cardId;
    if (!targetId) {
      toast.show('Pilih kartu terlebih dahulu untuk mencatat sesi.', 'info');
      return false;
    }

    const card = store.findCard(targetId);
    if (!card) {
      toast.error('Kartu tidak ditemukan.');
      return false;
    }

    const durationMinutes = Math.round(this.totalSeconds / 60);
    const logMarkdown = formatSessionLogMarkdown({
      durationMinutes,
      mode: this.mode,
      date: new Date(),
    });

    const updatedContent = card.content ? `${card.content.trim()}\n\n${logMarkdown}` : logMarkdown;

    const ok = await store.updateCard(targetId, { content: updatedContent });
    if (ok) {
      toast.success(`Sesi fokus berhasil dicatat ke dalam kartu "${card.title}".`);
      return true;
    } else {
      toast.error('Gagal mencatat sesi fokus.');
      return false;
    }
  }

  private clearInterval() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const pomodoro = new PomodoroStore();
