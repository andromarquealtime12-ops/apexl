const CACHE_NAME = 'apexl-v6';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Repeating alarm state (seller new-order alerts)
const alarmTimers = new Map();

function stopAlarm(tag) {
  const t = alarmTimers.get(tag);
  if (t) {
    clearInterval(t.interval);
    clearTimeout(t.timeout);
    alarmTimers.delete(tag);
  }
}

// Web Push handler - shows notification on lock screen / home screen
self.addEventListener('push', (event) => {
  let data = { title: 'APEXL', body: '', url: '/', tag: 'ayiti-marche' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: data.tag,
    data: { url: data.url },
    vibrate: [300, 120, 300, 120, 500],
    requireInteraction: true,
    renotify: true,
    silent: false,
    timestamp: Date.now(),
    actions: [
      { action: 'open', title: data.actionOpen || 'Open' },
      { action: 'dismiss', title: data.actionDismiss || 'Dismiss' },
    ],
  };

  const show = () => self.registration.showNotification(data.title, options);

  // Loud repeating alert for up to 5 minutes (sellers / restaurants)
  if (data.repeat) {
    stopAlarm(data.tag);
    const interval = setInterval(() => {
      self.registration.showNotification(data.title, {
        ...options,
        timestamp: Date.now(),
      });
    }, 20000);
    const timeout = setTimeout(() => stopAlarm(data.tag), 5 * 60 * 1000);
    alarmTimers.set(data.tag, { interval, timeout });
  }

  event.waitUntil(show());
});

// Push notification click handler
self.addEventListener('notificationclick', (event) => {
  stopAlarm(event.notification.tag);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  stopAlarm(event.notification.tag);
});

// Allow the app to stop the alarm (e.g. seller opened the dashboard)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'STOP_ALARM') {
    if (event.data.tag) stopAlarm(event.data.tag);
    else for (const tag of Array.from(alarmTimers.keys())) stopAlarm(tag);
  }
});

