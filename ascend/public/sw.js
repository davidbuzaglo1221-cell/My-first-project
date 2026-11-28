// Instant launches: the app shell is served from cache and refreshed in the background.
// Audio streams straight from the network (range requests for seeking are never cached).
const CACHE = 'hamasa-v12'
// Hashed build files never change, so they live in their own cache that survives updates:
// a page that is still running the previous version can always finish loading its own files.
const ASSETS = 'hamasa-assets'
const SHELL = ['./manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png']
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})
const timeout = (ms) => new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.includes('/audio/') || req.headers.has('range')) return
  // The page itself: always the newest version when online (so it never points at files that are gone),
  // the saved copy only when offline or the network is very slow.
  if (req.mode === 'navigate') {
    const net = fetch(req, { cache: 'no-store' }).then((r) => {
      if (r.ok) {
        const copy = r.clone()
        caches.open(CACHE).then((c) => c.put('./index.html', copy))
      }
      return r
    })
    e.respondWith(
      Promise.race([net, timeout(4000)]).catch(() => caches.match('./index.html').then((hit) => hit || net)),
    )
    e.waitUntil(net.catch(() => {}))
    return
  }
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.open(ASSETS).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((r) => {
              if (r.status === 200) c.put(req, r.clone())
              return r
            }),
        ),
      ),
    )
    return
  }
  // Photos and icons: saved copy first, refreshed in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => {
        if (r.status === 200) {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return r
      })
      if (hit) {
        e.waitUntil(net.catch(() => {}))
        return hit
      }
      return net
    }),
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
