import { join, normalize, resolve } from 'node:path';
import { env, features } from './env.ts';
import { migrate } from './db/migrate.ts';
import { startJobs } from './jobs/scheduler.ts';
import { handleSupabaseWebhook } from './webhook.ts';
import { authenticate } from './supabase.ts';
import { deleteSubscription, saveSubscription } from './push.ts';

const DIST = resolve(env.distDir);

/** Sajikan file statis dari dist/ dengan fallback SPA ke index.html. */
async function serveStatic(pathname: string): Promise<Response> {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const filePath = resolve(join(DIST, rel));
  if (filePath.startsWith(DIST)) {
    const file = Bun.file(filePath);
    if (rel && (await file.exists())) {
      const immutable = rel.startsWith('assets');
      return new Response(file, {
        headers: {
          'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        },
      });
    }
  }
  const index = Bun.file(join(DIST, 'index.html'));
  if (await index.exists()) {
    return new Response(index, { headers: { 'cache-control': 'no-cache' } });
  }
  return new Response('Frontend belum di-build. Jalankan: bun run build', { status: 404 });
}

async function handlePushSubscription(req: Request): Promise<Response> {
  if (!features.internalDb || !features.supabaseAdmin) {
    return Response.json({ error: 'push tidak dikonfigurasi' }, { status: 503 });
  }
  const userId = await authenticate(req);
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;
  if (!body?.endpoint) return Response.json({ error: 'endpoint wajib' }, { status: 400 });

  if (req.method === 'DELETE') {
    await deleteSubscription(userId, body.endpoint);
    return Response.json({ ok: true });
  }
  if (!body.keys?.p256dh || !body.keys?.auth) {
    return Response.json({ error: 'keys wajib' }, { status: 400 });
  }
  await saveSubscription(
    userId,
    { endpoint: body.endpoint, keys: { p256dh: body.keys.p256dh, auth: body.keys.auth } },
    req.headers.get('user-agent'),
  );
  return Response.json({ ok: true });
}

export function createServer(port = env.port) {
  return Bun.serve({
    port,
    routes: {
      '/api/health': () => Response.json({ status: 'ok', time: new Date().toISOString() }),
      '/api/config': () =>
        Response.json(
          {
            supabaseUrl: env.supabaseUrl,
            supabaseAnonKey: env.supabaseAnonKey,
            vapidPublicKey: env.vapidPublicKey,
          },
          { headers: { 'cache-control': 'no-cache' } },
        ),
      '/api/webhook/supabase': { POST: handleSupabaseWebhook },
      '/api/push/subscription': { POST: handlePushSubscription, DELETE: handlePushSubscription },
      '/api/*': () => Response.json({ error: 'not found' }, { status: 404 }),
    },
    fetch(req) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      return serveStatic(new URL(req.url).pathname);
    },
    error(err) {
      console.error('[server]', err);
      return Response.json({ error: 'internal error' }, { status: 500 });
    },
  });
}

if (import.meta.main) {
  if (features.internalDb) {
    await migrate();
  } else {
    console.warn('[server] DATABASE_URL kosong → sinkronisasi ke Postgres internal nonaktif');
  }
  const server = createServer();
  console.log(`[server] papanote berjalan di http://localhost:${server.port}`);
  if (env.jobsEnabled) startJobs();
}
