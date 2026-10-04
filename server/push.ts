import webpush from 'web-push';
import { db } from './db/client.ts';
import { env, features } from './env.ts';

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;
function ensureConfigured(): boolean {
  if (!features.push) return false;
  if (!configured) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    configured = true;
  }
  return true;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Kirim push ke semua subscription (tim internal berbagi papan), kecuali milik excludeUserId.
 * Subscription kedaluwarsa (404/410) otomatis dihapus.
 */
export async function broadcastPush(msg: PushMessage, excludeUserId?: string | null): Promise<number> {
  if (!ensureConfigured()) return 0;
  const sql = db();
  const subs: SubscriptionRow[] = excludeUserId
    ? await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id <> ${excludeUserId}`
    : await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`;

  const payload = JSON.stringify(msg);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        } else {
          console.warn('[push] gagal kirim:', status ?? err);
        }
      }
    }),
  );
  return sent;
}

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string | null,
): Promise<void> {
  await db()`
    INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
    VALUES (${sub.endpoint}, ${userId}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${userAgent})
    ON CONFLICT (endpoint) DO UPDATE
      SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
          user_agent = EXCLUDED.user_agent`;
}

export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  await db()`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${userId}`;
}
