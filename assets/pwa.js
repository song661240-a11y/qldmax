(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js", {
        scope: "./",
        updateViaCache: "none"
      });

      // 每次開啟主動檢查新版，但不強制中斷正在進行的操作。
      registration.update().catch(() => {});

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed" || !navigator.serviceWorker.controller) return;
          showUpdateBanner(() => {
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          });
        });
      });
    } catch (error) {
      console.error("PWA Service Worker 註冊失敗：", error);
    }
  });

  function showUpdateBanner(onReload) {
    if (document.getElementById("pwa-update-banner")) return;
    const banner = document.createElement("div");
    banner.id = "pwa-update-banner";
    banner.innerHTML = `
      <div class="pwa-update-copy">
        <strong>股票資產已有新版</strong>
        <span>重新載入後套用，不會刪除本機或雲端資料。</span>
      </div>
      <button type="button">重新載入</button>
    `;
    banner.querySelector("button").addEventListener("click", onReload);
    document.body.appendChild(banner);
  }
})();
