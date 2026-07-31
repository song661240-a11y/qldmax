const CACHE_VERSION = "stock-assets-pwa-v4.5.0-input-history-fix-20260731";
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/tailwind.css",
  "./assets/app.css",
  "./assets/app.js",
  "./assets/pwa.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/favicon-64.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => ![APP_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

const isLiveDataRequest = url =>
  url.hostname.includes("finnhub.io") ||
  url.hostname.includes("googleapis.com") ||
  url.hostname.includes("firebase") ||
  url.hostname.includes("google.com");

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 行情、Firebase 與登入資料永遠走網路，不寫入快取。
  if (isLiveDataRequest(url)) return;

  // HTML 採網路優先，避免 GitHub Pages 更新後仍顯示舊版。
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(APP_CACHE).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(async () =>
          (await caches.match("./index.html")) ||
          (await caches.match("./")) ||
          new Response("離線且尚無可用快取。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
        )
    );
    return;
  }

  // 同來源靜態檔採快取優先並背景更新。
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const networkPromise = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(APP_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => null);
      return cached || await networkPromise || new Response("Not available", { status: 503 });
    })());
    return;
  }

  // React、Tailwind 等 CDN：首次上線載入後快取，之後可離線開啟介面。
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      const copy = response.clone();
      caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
      return response;
    } catch (error) {
      return new Response("External resource unavailable", { status: 503 });
    }
  })());
});
