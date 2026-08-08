(() => {
  if (!("serviceWorker" in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js", {
        scope: "./",
        updateViaCache: "none"
      });

      registration.update().catch(() => {});

      if (registration.waiting) showUpdateBanner(() => activateWaiting(registration));

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed" || !navigator.serviceWorker.controller) return;
          showUpdateBanner(() => activateWaiting(registration));
        });
      });
    } catch (error) {
      console.error("PWA Service Worker 註冊失敗：", error);
    }
  });

  function activateWaiting(registration) {
    const waiting = registration.waiting;
    if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    else {
      registration.update().finally(() => window.location.reload());
    }
  }

  function showUpdateBanner(onReload) {
    if (document.getElementById("pwa-update-banner")) return;
    const banner = document.createElement("div");
    banner.id = "pwa-update-banner";
    banner.innerHTML = `
      <div class="pwa-update-copy">
        <strong>股票資產已有新版</strong>
        <span>v5.5 已新增槓桿股票換算器，可用 Finnhub 查兩檔現價並雙向換算未來價格與漲跌幅；完全不影響 IB 主策略。</span>
      </div>
      <button type="button">套用新版</button>
    `;
    banner.querySelector("button").addEventListener("click", onReload);
    document.body.appendChild(banner);
  }
})();
