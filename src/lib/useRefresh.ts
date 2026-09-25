import { useEffect } from "react";

/** Re-run a loader when the window regains focus (keeps dashboards fresh without a paid realtime service). */
export function useRefreshOnFocus(load: () => void) {
  useEffect(() => {
    let last = Date.now();
    const h = () => {
      if (document.hidden || Date.now() - last < 15000) return;
      last = Date.now();
      load();
    };
    window.addEventListener("focus", h);
    document.addEventListener("visibilitychange", h);
    return () => { window.removeEventListener("focus", h); document.removeEventListener("visibilitychange", h); };
  }, [load]);
}
