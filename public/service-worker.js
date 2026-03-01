
const SW_VERSION = 'v10';
const APP_CACHE = `pesaro-cimitero-app-${SW_VERSION}`;
const TILES_CACHE = `map-tiles-${SW_VERSION}`;
const DATA_CACHE = `map-data-${SW_VERSION}`;
const CACHE_ALLOWLIST = [APP_CACHE, TILES_CACHE, DATA_CACHE];
const IS_LOCALHOST = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const CACHE_STAMP_HEADER = 'x-sw-cached-at';
const NETWORK_TIMEOUT_MS = 8000;
const LOCAL_DATA_TIMEOUT_MS = 20000;

const CACHE_TTL_MS = {
  [APP_CACHE]: 24 * 60 * 60 * 1000,
  [TILES_CACHE]: 7 * 24 * 60 * 60 * 1000,
  [DATA_CACHE]: 15 * 60 * 1000,
};

const CACHE_MAX_ENTRIES = {
  [APP_CACHE]: 120,
  [TILES_CACHE]: 700,
  [DATA_CACHE]: 40,
};

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/data/1dzlxUTK3bz-7kChq1HASlXEpn6t5uQ8.kml',
];
const OFFLINE_FALLBACK_HTML = `
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #111827; color: #f9fafb; display: grid; place-items: center; min-height: 100vh; }
    main { max-width: 460px; padding: 24px; text-align: center; }
    h1 { font-size: 1.4rem; margin: 0 0 12px; }
    p { opacity: 0.9; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <h1>Connessione non disponibile</h1>
    <p>L'app non riesce a caricare nuovi dati in questo momento. Riprova appena torna la rete.</p>
  </main>
</body>
</html>
`;

const isCacheableResponse = (response) => Boolean(response) && (response.ok || response.type === 'opaque');

const decorateCacheResponse = async (response) => {
  if (!response || response.type === 'opaque') {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set(CACHE_STAMP_HEADER, String(Date.now()));
  const payload = await response.clone().blob();
  return new Response(payload, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const isResponseFresh = (cacheName, response) => {
  const ttl = CACHE_TTL_MS[cacheName];
  if (!ttl || !response || response.type === 'opaque') return true;
  const cachedAtRaw = response.headers.get(CACHE_STAMP_HEADER);
  if (!cachedAtRaw) return true;
  const cachedAt = Number(cachedAtRaw);
  if (!Number.isFinite(cachedAt)) return true;
  return Date.now() - cachedAt <= ttl;
};

const trimCache = async (cacheName) => {
  const maxEntries = CACHE_MAX_ENTRIES[cacheName];
  if (!maxEntries) return;

  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  if (requests.length <= maxEntries) return;

  const surplus = requests.length - maxEntries;
  await Promise.all(requests.slice(0, surplus).map((request) => cache.delete(request)));
};

const fetchWithTimeout = async (request, timeoutMs = NETWORK_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(request, { signal: controller.signal });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`Network timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetchWithTimeout(request);
    if (isCacheableResponse(networkResponse)) {
      const cacheEntry = await decorateCacheResponse(networkResponse);
      await cache.put(request, cacheEntry);
      await trimCache(cacheName);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse && isResponseFresh(cacheName, cachedResponse)) {
      return cachedResponse;
    }
    if (cachedResponse) await cache.delete(request);
    throw error;
  }
};

const cacheFirst = async (request, cacheName, timeoutMs = NETWORK_TIMEOUT_MS) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse && isResponseFresh(cacheName, cachedResponse)) return cachedResponse;
  if (cachedResponse) await cache.delete(request);

  const networkResponse = await fetchWithTimeout(request, timeoutMs);
  if (isCacheableResponse(networkResponse)) {
    const cacheEntry = await decorateCacheResponse(networkResponse);
    await cache.put(request, cacheEntry);
    await trimCache(cacheName);
  }
  return networkResponse;
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const isFresh = cachedResponse ? isResponseFresh(cacheName, cachedResponse) : false;
  if (cachedResponse && !isFresh) {
    await cache.delete(request);
  }
  const networkPromise = fetchWithTimeout(request)
    .then(async (networkResponse) => {
      if (isCacheableResponse(networkResponse)) {
        const cacheEntry = await decorateCacheResponse(networkResponse);
        await cache.put(request, cacheEntry);
        await trimCache(cacheName);
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse && isFresh) {
    return cachedResponse;
  }
  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }
  throw new Error('Network and cache both unavailable');
};

self.addEventListener('install', (event) => {
  if (IS_LOCALHOST) {
    self.skipWaiting();
    return;
  }
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        })
    );
    return;
  }

  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!CACHE_ALLOWLIST.includes(cacheName)) {
              return caches.delete(cacheName);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (IS_LOCALHOST) return;
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isAppNavigation =
    request.mode === 'navigate' ||
    (url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html'));

  if (isAppNavigation) {
    event.respondWith(
      networkFirst(request, APP_CACHE).catch(async () => {
        const cachedPage = await caches.match('/index.html');
        if (cachedPage) return cachedPage;
        return new Response(OFFLINE_FALLBACK_HTML, {
          status: 503,
          statusText: 'Offline',
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      })
    );
    return;
  }

  if (url.hostname.includes('google.com') && url.pathname.includes('/vt')) {
    event.respondWith(
      cacheFirst(request, TILES_CACHE).catch(() => new Response(null, { status: 204 }))
    );
    return;
  }

  const isBundledMapDataRequest =
    url.origin === self.location.origin &&
    url.pathname.startsWith('/data/') &&
    (url.pathname.endsWith('.kml') || url.pathname.endsWith('.json') || url.pathname.endsWith('.geojson'));

  if (isBundledMapDataRequest) {
    event.respondWith(
      cacheFirst(request, DATA_CACHE, LOCAL_DATA_TIMEOUT_MS).catch(() => networkFirst(request, DATA_CACHE))
    );
    return;
  }

  const isRemoteMapDataRequest =
    (url.hostname.includes('google.com') && url.pathname.includes('/maps/d/kml')) ||
    (url.hostname.includes('corsproxy.io') && url.search.includes('google.com/maps/d/kml')) ||
    (url.hostname.includes('allorigins.win') && url.search.includes('google.com/maps/d/kml'));

  if (isRemoteMapDataRequest) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  const isAppAsset =
    url.origin === self.location.origin &&
    (
      url.pathname.startsWith('/assets/') ||
      ['script', 'style', 'font', 'manifest', 'image', 'worker'].includes(request.destination)
    );

  if (isAppAsset) {
    event.respondWith(staleWhileRevalidate(request, APP_CACHE));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
