import { db } from './db/client.ts';
import { broadcastPush } from './push.ts';
import { isNotifiableCardChange, isSyncTable, parseWebhookPayload, upsertRow, verifySecret } from './sync.ts';
import { env } from './env.ts';

/** POST /api/webhook/supabase — menerima Database Webhook dari Supabase. */
export async function handleSupabaseWebhook(req: Request): Promise<Response> {
  if (!verifySecret(req.headers.get('x-webhook-secret'), env.webhookSecret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const payload = parseWebhookPayload(body);
  if (!payload || payload.schema !== 'public' || !isSyncTable(payload.table)) {
    return Response.json({ error: 'unsupported payload' }, { status: 400 });
  }

  // DELETE diabaikan: penghapusan fisik di Supabase hanya terjadi karena purge cache.
  if (payload.type === 'DELETE' || !payload.record) {
    return Response.json({ ok: true, ignored: true });
  }

  try {
    await upsertRow(db(), payload.table, payload.record);
  } catch (err) {
    console.error('[webhook] upsert gagal:', err);
    // 500 → pg_net tidak retry, tapi job rekonsiliasi akan menarik ulang baris ini.
    return Response.json({ error: 'sync failed' }, { status: 500 });
  }

  if (
    payload.table === 'cards' &&
    payload.type === 'UPDATE' &&
    isNotifiableCardChange(payload.record, payload.old_record)
  ) {
    const r = payload.record;
    broadcastPush(
      {
        title: 'Kartu diperbarui',
        body: `"${String(r.title)}" baru saja diubah.`,
        url: `/#/card/${String(r.id)}`,
        tag: `card-${String(r.id)}`,
      },
      typeof r.updated_by === 'string' ? r.updated_by : null,
    ).catch((err) => console.warn('[webhook] push gagal:', err));
  }

  return Response.json({ ok: true });
}
