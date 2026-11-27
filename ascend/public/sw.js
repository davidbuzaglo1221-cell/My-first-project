// Instant launches: the app shell is served from cache and refreshed in the background.
// Audio streams straight from the network (range requests for seeking are never cached).
const CACHE = 'hamasa-v4'
const SHELL = ['./', './index.html', './manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png']
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.includes('/audio/') || req.headers.has('range')) return
  if (req.mode === 'navigate') {
    const fresh = fetch(req).then((r) => {
      if (r.ok) caches.open(CACHE).then((c) => c.put('./index.html', r.clone()))
      return r
    })
    e.respondWith(caches.match('./index.html').then((hit) => hit || fresh).catch(() => fresh))
    e.waitUntil(fresh.catch(() => {}))
    return
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.status === 200) caches.open(CACHE).then((c) => c.put(req, r.clone()))
          return r
        }),
    ),
  )
})

// Notifications from the app: the daily sender pushes {title, body, url}; a tap opens that place in the app.
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'המסע שלי', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'daily', data: { url: d.url || './' },
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = new URL(e.notification.data && e.notification.data.url ? e.notification.data.url : './', self.registration.scope).href
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus() }
    return clients.openWindow(target)
  }))
})
