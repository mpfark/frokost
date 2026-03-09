// Push notification event handler for service worker
// This file is loaded by the service worker to handle push events

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/pwa-192x192.png',
      badge: data.badge || '/pwa-192x192.png',
      tag: data.tag || 'default',
      data: data.data || {},
      vibrate: [200, 100, 200],
      requireInteraction: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Plusfrokost', options)
    );
  } catch (e) {
    console.error('Push event error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
