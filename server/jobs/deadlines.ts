import { db } from '../db/client.ts';
import { broadcastPush } from '../push.ts';

export type ReminderKind = '24h' | '1h';

const HOUR = 60 * 60 * 1000;

/**
 * Tentukan jenis pengingat yang jatuh tempo untuk sebuah deadline.
 * - '1h'  : deadline dalam (0, 1 jam]
 * - '24h' : deadline dalam (1 jam, 24 jam]
 * - null  : sudah lewat atau masih lebih dari 24 jam
 */
export function reminderKindFor(deadline: Date, now: Date): ReminderKind | null {
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return null;
  if (diff <= HOUR) return '1h';
  if (diff <= 24 * HOUR) return '24h';
  return null;
}

export function reminderBody(title: string, kind: ReminderKind, deadline: Date): string {
  const when = deadline.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });
  const prefix = kind === '1h' ? 'Kurang dari 1 jam lagi' : 'Kurang dari 24 jam lagi';
  return `${prefix}: "${title}" (tenggat ${when} WIB)`;
}

interface DueCard {
  id: string;
  title: string;
  deadline_date: Date;
}

/** Kirim pengingat deadline 24 jam & 1 jam sebelumnya (dedupe via notification_log). */
export async function sendDeadlineReminders(now = new Date()): Promise<number> {
  const sql = db();
  const until = new Date(now.getTime() + 24 * HOUR);
  const cards: DueCard[] = await sql`
    SELECT id, title, deadline_date FROM cards
    WHERE enable_notification = TRUE AND deleted_at IS NULL
      AND deadline_date > ${now} AND deadline_date <= ${until}`;

  let sent = 0;
  for (const card of cards) {
    const deadline = new Date(card.deadline_date);
    const kind = reminderKindFor(deadline, now);
    if (!kind) continue;
    // Klaim slot notifikasi secara atomik; jika sudah ada → sudah pernah dikirim.
    const claimed = await sql`
      INSERT INTO notification_log (card_id, kind, deadline)
      VALUES (${card.id}, ${kind}, ${deadline})
      ON CONFLICT DO NOTHING RETURNING card_id`;
    if (claimed.length === 0) continue;
    await broadcastPush({
      title: 'Pengingat tenggat',
      body: reminderBody(card.title, kind, deadline),
      url: `/#/card/${card.id}`,
      tag: `deadline-${card.id}-${kind}`,
    });
    sent++;
  }
  return sent;
}
