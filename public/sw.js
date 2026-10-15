/* The production build stamps this worker and writes an immutable asset manifest. */
const BUILD_VERSION = "__DERBY_BUILD_VERSION__";
const CACHE_PREFIX = "derby-offline-";
const CACHE_NAME = CACHE_PREFIX + BUILD_VERSION;
const baseURL = self.registration.scope;
const absolute = path => new URL(path, baseURL).href;
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const response = await fetch(absolute(`cache-manifest.${BUILD_VERSION}.json`), { cache: "no-store" });
    if (!response.ok) throw new Error("Offline asset manifest unavailable");
    const manifest = await response.json();
    if (manifest.version !== BUILD_VERSION || !Array.isArray(manifest.assets)) throw new Error("Offline build version mismatch");
    const urls = manifest.assets.map(absolute);
    if (urls.some(url => new URL(url).origin !== self.location.origin)) throw new Error("Offline assets must be same-origin");
    const cache = await caches.open(CACHE_NAME);
    try {
      // addAll commits the complete shell together; reload avoids stale HTTP-cache HTML.
      await cache.addAll(urls.map(url => new Request(url, { cache: "reload" })));
      await cache.put(absolute("cache-manifest.json"), new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/json" } }));
    } catch (error) { await caches.delete(CACHE_NAME); throw error; }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Only this build’s public static files are present. Preview servers add Vary:
    // Origin, while module requests have a different Origin header than addAll.
    const cached = await cache.match(event.request, { ignoreVary: true });
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === "navigate") {
        const page = await cache.match(absolute("index.html"), { ignoreVary: true });
        if (page) return page;
      }
      throw error;
    }
  })());
});
