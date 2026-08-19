// ============================================================
//  Browser push registration.
//
//  Asks permission once, registers the service worker and hands
//  the subscription to the API. Silently does nothing when the
//  server has no VAPID keys, so nothing breaks if push is off.
// ============================================================
import { apiPushKey, apiPushSubscribe } from './api';

/** VAPID keys travel base64url-encoded but the API wants raw bytes. */
function urlBase64ToBytes(base64: string): BufferSource {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

export async function enablePushNotifications(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'This browser does not support notifications.' };
  }

  try {
    const { enabled, publicKey } = await apiPushKey();
    if (!enabled || !publicKey) {
      return { ok: false, reason: 'Push is not configured on the server yet.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Notifications were blocked in the browser.' };
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      }));

    await apiPushSubscribe(sub.toJSON());
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Could not enable notifications.',
    };
  }
}
