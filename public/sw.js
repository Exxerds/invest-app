/* ============================================================
   Service worker — web push notifications (PDF p.3).

   Kept deliberately small: it only handles push delivery and
   clicks. There is no offline caching, because a trading
   platform showing stale prices would be worse than useless.
   ============================================================ */

self.addEventListener('install', () => {
  // Take over straight away rather than waiting for a reload
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Oak Haven Yield', body: '', url: '/' };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: payload.tag || 'ohy',
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus an open tab if there is one, otherwise open a new window
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
