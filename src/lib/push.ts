import { getConfig, supabase } from './supabase';

export type PushResult = 'enabled' | 'unsupported' | 'denied' | 'not-configured' | 'error';

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Service worker gagal didaftarkan:', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
}

/** Minta izin notifikasi & daftarkan subscription Web Push ke server (idempoten). */
export async function enablePush(): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported';
  const { vapidPublicKey } = getConfig();
  if (!vapidPublicKey) return 'not-configured';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  try {
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
    if (!reg) return 'unsupported';
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    const subJson = sub.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) return 'error';

    const sb = supabase();
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return 'error';

    const { error: insertError } = await sb.from('push_subscriptions').upsert({
      endpoint: subJson.endpoint,
      user_id: userId,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      user_agent: navigator.userAgent,
    });
    return insertError ? 'error' : 'enabled';
  } catch (err) {
    console.error('Gagal mengaktifkan push:', err);
    return 'error';
  }
}

export function pushMessage(result: PushResult): string {
  switch (result) {
    case 'enabled': return 'Notifikasi browser aktif.';
    case 'unsupported': return 'Browser ini tidak mendukung Web Push.';
    case 'denied': return 'Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.';
    case 'not-configured': return 'Server belum dikonfigurasi untuk Web Push.';
    default: return 'Gagal mendaftarkan notifikasi.';
  }
}
