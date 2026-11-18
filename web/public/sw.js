// Service worker: keeps the app usable with no signal in the gym.
// The data already lives in IndexedDB; this caches the app itself.
//  - install: every page's HTML plus the scripts and styles those pages reference
//  - pages: network first (fresh after a deploy), cached copy when offline
//  - /_next/static: cache first (file names change on every build)
//  - /api: never cached
// The version comes from the registration URL (?v=<build>), so a deploy installs a fresh cache
// and removes the old one.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `app-${VERSION}`;
const PAGES = [
  "/", "/welcome", "/workout", "/workouts", "/summary", "/history", "/history/view", "/exercises", "/exercises/view",
  "/templates/edit", "/nutrition", "/nutrition/add", "/nutrition/photo", "/nutrition/barcode", "/nutrition/goals",
  "/progress", "/body", "/profile", "/cardio", "/photos", "/learn", "/learn/read", "/achievements",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const assets = new Set();
      for (const page of PAGES) {
        try {
          const res = await fetch(page, { cache: "no-store" });
          if (!res.ok) continue;
          const html = await res.clone().text();
          await cache.put(page, res);
          for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+/g)) assets.add(m[0]);
        } catch {
          // Offline during install: the next visit retries.
        }
      }
      await Promise.all(
        [...assets].map((url) =>
          cache.add(url).catch(() => {
            /* one missing file must not fail the whole install */
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Spoken clips (tts-*) are paid for and do not change with a deploy: keep them.
      for (const key of await caches.keys()) if (key !== CACHE && !key.startsWith("tts-")) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        } catch {
          // Pages differ only by query (?id=…); the data comes from IndexedDB.
          return (await caches.match(url.pathname)) || (await caches.match("/")) || Response.error();
        }
      })(),
    );
  }
});
