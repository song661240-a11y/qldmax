(() => {
  if (!("serviceWorker" in navigator)) return;

  const PWA_VERSION = "6.0.0";
  const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
  let reloading = false;
  let lastUpdateCheck = 0;
  let registrationRef = null;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  function activateWaiting(registration) {
    const waiting = registration?.waiting;
    if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    else registration?.update().catch(() => {});
  }

  function showUpdateBanner(registration) {
    if (document.getElementById("pwa-update-banner")) return;
    const banner = document.createElement("div");
    banner.id = "pwa-update-banner";
    banner.innerHTML = `
      <div class="pwa-update-copy">
        <strong>發現新版 v${PWA_VERSION}</strong>
        <span>新版加入系統健康直接處理捷徑、統一 App 內確認／輸入視窗與 Bottom Sheet 固定操作列，並保留 v5.9 衝突防呆與 Revision 鎖。建議立即更新。</span>
      </div>
      <button type="button">立即更新</button>
    `;
    banner.querySelector("button").addEventListener("click", () => activateWaiting(registration));
    document.body.appendChild(banner);
  }

  async function checkForUpdate(force = false) {
    const registration = registrationRef;
    if (!registration) return;
    const now = Date.now();
    if (!force && now - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastUpdateCheck = now;
    try {
      await registration.update();
      if (registration.waiting) showUpdateBanner(registration);
    } catch (error) {
      console.warn("PWA 新版本檢查失敗：", error);
    }
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js", {
        scope: "./",
        updateViaCache: "none"
      });
      registrationRef = registration;
      if (registration.waiting) showUpdateBanner(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner(registration);
        });
      });
      checkForUpdate(true);
    } catch (error) {
      console.error("PWA Service Worker 註冊失敗：", error);
    }
  });

  const foregroundCheck = () => {
    if (document.visibilityState && document.visibilityState !== "visible") return;
    checkForUpdate(false);
  };
  document.addEventListener("visibilitychange", foregroundCheck);
  window.addEventListener("pageshow", foregroundCheck);
  window.addEventListener("focus", foregroundCheck);
})();
