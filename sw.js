/* ConWork service worker
   - makes the app installable and lets it open without internet (the last copy it saw, or offline.html)
   - shows system notifications and opens the right page when one is tapped
   - push: ready for Web Push (a server sends {title, body, url, tag, notif}) */
const VERSION = 'cw-2026-11-18-1';
const SHELL = 'cw-shell-' + VERSION;
const RUNTIME = 'cw-runtime-' + VERSION;
const PRECACHE = [
  'offline.html',
  'manifest.webmanifest',
  'img/logo.png',
  'img/icons/icon-192.png',
  'img/icons/icon-512.png',
  'img/icons/badge-96.png'
];
/* never cached: live data and sign-in */
const NO_CACHE = /supabase\.co|neon\.tech|\/api\/|\/auth\/|\/rest\/|\/realtime\//i;
/* other sites whose files the pages need (styles, fonts, libraries): kept for offline use */
const CDN = /cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/i;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('cw-') && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (_) { } }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NO_CACHE.test(req.url)) return;

  /* pages: always the newest from the internet; offline → the last copy, then offline.html */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const pre = await e.preloadResponse;
        const res = pre || await fetch(req);
        if (res && res.ok && url.origin === location.origin) { const c = await caches.open(RUNTIME); c.put(req, res.clone()); }
        return res;
      } catch (_) {
        return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('offline.html'));
      }
    })());
    return;
  }

  /* own files (js, css, images): newest first, cached copy when offline */
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const c = await caches.open(RUNTIME); c.put(req, res.clone()); }
        return res;
      } catch (_) {
        const hit = await caches.match(req) || await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        throw _;
      }
    })());
    return;
  }

  /* libraries and fonts from other sites: cached copy at once, refreshed in the background */
  if (CDN.test(url.host)) {
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
});

/* ---------- notifications ---------- */
function show(data) {
  const d = data || {};
  return self.registration.showNotification(d.title || 'ConWork', {
    body: d.body || '',
    icon: d.icon || 'img/icons/icon-192.png',
    badge: 'img/icons/badge-96.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    timestamp: d.timestamp || Date.now(),
    vibrate: [80, 40, 80],
    data: { url: d.url || 'app.html', notif: d.notif || null }
  });
}

/* Web Push from a server (used once push is set up on Supabase) */
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    /* ConWork is open and in front: the bell already shows it (Safari must always show one, so it still does) */
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const inFront = wins.some((c) => c.focused && c.visibilityState === 'visible');
    const strict = /Safari/.test(self.navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(self.navigator.userAgent);
    if (inFront && !strict) return;
    await show(data);
    if (typeof data.badge === 'number' && self.navigator && self.navigator.setAppBadge) { try { await self.navigator.setAppBadge(data.badge); } catch (_) { } }
  })());
});

/* the page asks the worker to show one (works on Android, where new Notification() is not allowed) */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'cw-notify') e.waitUntil(show(e.data.payload));
});

/* tap on a notification: bring ConWork forward (or open it) and open what it is about */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const target = new URL(d.url || 'app.html', self.registration.scope);
  if (d.notif) target.searchParams.set('notif', d.notif);
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const samePage = all.find((c) => new URL(c.url).pathname === target.pathname);
    const any = samePage || all[0];
    if (any) {
      try { await any.focus(); } catch (_) { }
      if (samePage) { any.postMessage({ type: 'cw-open', notif: d.notif || null, url: target.href }); return; }
      if (any.navigate) { try { await any.navigate(target.href); return; } catch (_) { } }
    }
    await self.clients.openWindow(target.href);
  })());
});
