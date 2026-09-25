import { useState } from "react";
import { Link } from "react-router-dom";

const KEY = "cw-cookie-notice";
function seen() { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }

/** One-time notice: the app only uses essential storage, so this informs rather than asks. */
export default function CookieNotice() {
  const [hide, setHide] = useState(seen());
  if (hide) return null;
  function ok() { try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setHide(true); }
  return (
    <div className="cookie-notice" role="region" aria-label="Cookie notice">
      <span>We only use essential browser storage to keep you signed in — no tracking or ads. <Link to="/cookies">Cookie Policy</Link></span>
      <button className="btn sm primary" onClick={ok}>OK</button>
    </div>
  );
}
