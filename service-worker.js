const CACHE_VERSION = "stock-assets-pwa-v5.5-leveragecalc-20260808";
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest?v=5.5.0",
  "./assets/tailwind.css?v=5.5.0",
  "./assets/app.css?v=5.5.0",
  "./assets/app.js?v=5.5.0",
  "./assets/pwa.js?v=5.5.0",
  "./icons/icon-192.png?v=5.5.0",
  "./icons/icon-512.png?v=5.5.0",
  "./icons/icon-maskable-512.png?v=5.5.0",
  "./icons/favicon-64.png?v=5.5.0"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL))
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
  url.hostname.includes("open.er-api.com") ||
  url.hostname.includes("googleapis.com") ||
  url.hostname.includes("firebase") ||
  url.hostname.includes("google.com");

const isCoreAppAsset = url => [
  "/assets/app.css",
  "/assets/app.js",
  "/assets/pwa.js",
  "/assets/tailwind.css"
].some(path => url.pathname.endsWith(path));

const isHtmlResponse = response => {
  const type = response?.headers?.get("content-type") || "";
  return response?.ok && type.toLowerCase().includes("text/html");
};

const isAppEntryNavigation = url =>
  url.origin === self.location.origin &&
  (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"));

async function networkFirst(request, cacheName = APP_CACHE) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(cacheName).then(cache => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    return (await caches.match(request)) || new Response("Not available offline", { status: 503 });
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 行情、匯率、Firebase 與登入資料永遠走網路，不寫入快取。
  if (isLiveDataRequest(url)) return;

  // 只有 App 根目錄與 index.html 才能當首頁快取。
  // 並且只接受 text/html，避免 PNG、404 或其他檔案污染首頁快取。
  if (request.mode === "navigate" && isAppEntryNavigation(url)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (isHtmlResponse(response)) {
          const copy = response.clone();
          caches.open(APP_CACHE).then(cache => cache.put("./index.html", copy));
        }
        return response;
      } catch (error) {
        const cached = await caches.match("./index.html");
        if (cached && isHtmlResponse(cached)) return cached;
        const root = await caches.match("./");
        if (root && isHtmlResponse(root)) return root;
        return new Response("離線且尚無可用首頁快取。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  // 其他導覽請求直接走網路，絕不寫入首頁快取。
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // 核心 CSS/JS 採網路優先。
  if (url.origin === self.location.origin && isCoreAppAsset(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他同來源靜態檔案採快取優先。
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(APP_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      } catch (error) {
        return new Response("Not available", { status: 503 });
      }
    })());
    return;
  }

  // React、Firebase 等 CDN：首次上線載入後快取。
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
