const CACHE_PREFIX = "turboscout-cache";
const CACHE_VERSION = "v1";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const MANIFEST_URL = "./asset-manifest.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);

        await cache.add(MANIFEST_URL);

        const res = await fetch(MANIFEST_URL, { cache: "no-store" });
        const manifest = await res.json();

        const filesObj = manifest.files || {};
        const entrypoints = manifest.entrypoints || [];

        const urlsToCache = new Set();

        urlsToCache.add("./");
        urlsToCache.add("./index.html");

        for (const key of Object.keys(filesObj)) {
          const url = filesObj[key];
          if (typeof url === "string") urlsToCache.add("." + url);
        }

        for (const url of entrypoints) {
          if (typeof url === "string") urlsToCache.add("." + url);
        }

        await cache.addAll(Array.from(urlsToCache));

        await self.skipWaiting();
      } catch (e) {
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match("./index.html");
        if (cachedIndex) return cachedIndex;

        return fetch(req);
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
//fallback to network
      try {
        const fresh = await fetch(req);
        if (req.method === "GET" && fresh && fresh.ok) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});