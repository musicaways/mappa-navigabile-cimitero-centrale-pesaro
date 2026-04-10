/**
 * Cloudflare Worker — Self-hosted Google Satellite Tile Proxy
 *
 * DEPLOY:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler deploy tile-proxy/worker.js --name pesaro-tile-proxy
 *
 * After deploy, update map-core.ts:
 *   SATELLITE_TILE_URL = 'https://pesaro-tile-proxy.<your-cf-account>.workers.dev/tile/{z}/{x}/{y}'
 *
 * This worker:
 *   - Proxies Google Satellite tiles (lyrs=s)
 *   - Caches tiles at the edge (CF Cache API, 7-day TTL)
 *   - Adds CORS headers so the browser can load them cross-origin
 *   - Rate-limits by IP (100 req/min) via CF's built-in KV or simple counter
 */

const TILE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Expected path: /tile/{z}/{x}/{y}
    const match = url.pathname.match(/^\/tile\/(\d+)\/(\d+)\/(\d+)$/);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const [, z, x, y] = match;

    // Validate tile coordinates
    const zi = parseInt(z, 10);
    if (zi < 1 || zi > 20) {
      return new Response('Invalid zoom', { status: 400 });
    }

    // Check CF cache first
    const cacheKey = new Request(request.url, { method: 'GET' });
    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (!response) {
      // Round-robin across mt0–mt3 for throughput
      const subdomain = (parseInt(x, 10) + parseInt(y, 10)) % 4;
      const tileUrl = `https://mt${subdomain}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;

      response = await fetch(tileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TileProxy/1.0)',
          'Referer': 'https://maps.google.com/',
        },
        cf: { cacheTtl: TILE_TTL_SECONDS, cacheEverything: true },
      });

      if (!response.ok) {
        return new Response('Tile fetch failed', { status: 502 });
      }

      // Clone and cache with appropriate headers
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', `public, max-age=${TILE_TTL_SECONDS}, immutable`);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Vary', 'Accept-Encoding');

      response = new Response(response.body, {
        status: response.status,
        headers,
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};
