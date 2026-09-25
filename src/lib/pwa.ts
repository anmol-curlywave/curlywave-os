// Service-worker registration + update handling (no third-party libraries).

let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();

export function isDesktopApp() {
  return typeof navigator !== "undefined" && /CurlywaveDesktop/i.test(navigator.userAgent);
}

export function onUpdateReady(cb: () => void) {
  listeners.add(cb);
  if (waiting) cb();
  return () => { listeners.delete(cb); };
}

function announce(sw: ServiceWorker) {
  waiting = sw;
  listeners.forEach((l) => l());
}

export function applyUpdate() {
  if (!waiting) { location.reload(); return; }
  waiting.postMessage({ type: "SKIP_WAITING" });
}

export function registerSW() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
      if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) announce(nw);
        });
      });
      // Check for a new version every 30 minutes and when the app regains focus.
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    } catch (e) {
      console.warn("Service worker registration failed", e);
    }
  });
}
