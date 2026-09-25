import { useEffect, useState } from "react";
import { isDesktopApp, onUpdateReady, applyUpdate } from "../lib/pwa";

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = "cw-install-dismissed";
function dismissed() { try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } }

/** Shows "Install app" (PWA) and "Update ready" notices. Hidden inside the desktop app. */
export default function InstallBanner() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [update, setUpdate] = useState(false);
  const [hide, setHide] = useState(dismissed());

  const standalone = typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone;

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", h);
    const off = onUpdateReady(() => setUpdate(true));
    return () => { window.removeEventListener("beforeinstallprompt", h); off(); };
  }, []);

  if (update) {
    return (
      <div className="alert info row" style={{ justifyContent: "space-between" }} role="status">
        <span>A new version of Curlywave OS is ready.</span>
        <button className="btn sm primary" onClick={applyUpdate}>Update now</button>
      </div>
    );
  }
  if (isDesktopApp() || standalone || hide) return null;

  function close() { try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } setHide(true); }

  if (evt) {
    return (
      <div className="alert info row" style={{ justifyContent: "space-between" }}>
        <span>Install Curlywave OS as an app on this device for one-click access.</span>
        <span className="row">
          <button className="btn sm primary" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>Install</button>
          <button className="btn sm" onClick={close}>Not now</button>
        </span>
      </div>
    );
  }
  if (ios) {
    return (
      <div className="alert info row" style={{ justifyContent: "space-between" }}>
        <span>Install on iPhone/iPad: tap <b>Share</b> → <b>Add to Home Screen</b>.</span>
        <button className="btn sm" onClick={close}>OK</button>
      </div>
    );
  }
  return null;
}
