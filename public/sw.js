/* ============================================================
 * ScholarX service worker (PWA)
 *
 * Strategy — the app is a live, authenticated Supabase client, so the SW
 * deliberately caches as little as possible:
 *   * /_next/static, /fonts, /icons, favicon, manifest, offline page
 *       -> cache-first (these files are immutable per build / never change)
 *   * document navigations (request.mode === "navigate")
 *       -> network-first; on network failure serve the precached
 *          /offline.html. HTML is NEVER cached: it is per-user and
 *          time-sensitive (marks, results, payments).
 *   * everything else (RSC payloads, Supabase REST/realtime, e-mail API,
 *     /_next/image, cross-origin Google Fonts)
 *       -> untouched, straight to the network.
 *
 * DEV MODE: the registration component registers this file as /sw.js?dev=1
 * during `next dev`. In dev the fetch listener returns immediately — no
 * caching at all — so HMR chunks and rebuilds always stay fresh.
 *
 * Bump VERSION whenever the precache list or caching rules change; old
 * caches are dropped on activate.
 * ============================================================ */

const VERSION = "v1";
const STATIC_CACHE = `scholarx-static-${VERSION}`;

const isDev = new URL(self.location.href).searchParams.has("dev");

const PRECACHE = [
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/favicon.ico",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // One missing file must not fail the whole install.
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("scholarx-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/** Immutable static asset: cache, else network (and populate the cache). */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

/** Navigation: always try the network; offline -> precached fallback page. */
async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    return (
      (await cache.match("/offline.html")) ||
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/offline.html"
  );
}

self.addEventListener("fetch", (event) => {
  // Dev passthrough — never intercept, never cache.
  if (isDev) return;

  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Cross-origin (Supabase, Google Fonts, EmailJS) is never ours to cache.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // RSC fetches, API routes, images, anything else: default browser handling.
});
