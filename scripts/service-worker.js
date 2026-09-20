/* Generated as app/sw.js by bygg-side.sh. No tile/API responses are cached. */
'use strict';
const VERSION = '__BUILD_VERSION__';
const SCOPE = new URL(self.registration.scope);
const PREFIX = `oppdretter:${SCOPE.pathname}:`;
const CACHE = `${PREFIX}${VERSION}`;
const INDEX = new URL('index.html', SCOPE).href;
const FILES = __PRECACHE_FILES__.map(path => new URL(path, SCOPE).href);
const ASSETS = new Set(FILES);
const IMMUTABLE = new Set(FILES.filter(path => path.includes(`/assets/${VERSION}/`)));

function matchingDocument(response, text) {
  return response.ok && response.headers.get('content-type')?.includes('text/html') &&
    text.includes(`<meta name="app-build" content="${VERSION}">`);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Verify HTML before publishing the cache: a deployment may change while
      // this worker is being downloaded. Mixed builds must fail installation.
      const html = await fetch(INDEX, { cache: 'no-store' });
      if (!matchingDocument(html, await html.clone().text())) throw new Error('Build changed');
      await Promise.all(FILES.map(async url => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok || response.type === 'opaque') throw new Error('Asset unavailable');
        await cache.put(url, response);
      }));
      await cache.put(INDEX, html);
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
    // Deliberately no skipWaiting: open pages keep their matching application.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function navigation(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(request, { cache: 'no-cache', signal: controller.signal });
    // Once the server responds, let slow connections finish downloading the page.
    clearTimeout(timeout);
    if (!response.ok) throw new Error('Page unavailable');
    const snapshot = response.clone();
    if (matchingDocument(snapshot, await snapshot.clone().text())) {
      try { await (await caches.open(CACHE)).put(INDEX, snapshot); }
      catch { /* Storage limits must not prevent a successful online load. */ }
    }
    return response;
  } catch (error) {
    const cached = await (await caches.open(CACHE)).match(INDEX);
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const isHome = url.pathname === SCOPE.pathname || url.pathname === new URL(INDEX).pathname;
  if (request.mode === 'navigate' && isHome) {
    event.respondWith(navigation(request));
    return;
  }
  if (!ASSETS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(url.href);
    if (IMMUTABLE.has(url.href) && saved) return saved;
    try {
      const response = await fetch(request);
      if (!response.ok) throw new Error('Asset unavailable');
      return response;
    } catch (error) {
      if (saved) return saved;
      throw error;
    }
  })());
});
