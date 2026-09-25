import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, CONSENT_VERSION } from "../lib/supabase";
import { useAuth } from "../lib/auth";

/** Shown once after sign-in when someone hasn't agreed to the current Privacy Policy and Terms (DPDP Act consent). */
export default function Consent() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const again = !!profile?.consent_version;

  async function accept() {
    setBusy(true); setErr("");
    const { error } = await supabase.from("profiles").update({ consent_version: CONSENT_VERSION }).eq("id", profile!.id);
    setBusy(false);
    if (error) setErr(error.message); else refreshProfile();
  }

  return (
    <main className="center-screen">
      <div className="card auth-card">
        <div className="brand" style={{ padding: "0 0 14px" }}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /> Curlywave OS</div>
        <h1 style={{ marginBottom: 4 }}>{again ? "We've updated our policies" : "Before you continue"}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          We use your name, email and work details only to run Curlywave OS and deliver our services. No tracking, no ads, never sold.
          You can download your data or ask us to delete it any time from <b>My account</b>.
        </p>
        {err && <div className="alert">{err}</div>}
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I agree to the <Link to="/privacy" target="_blank">Privacy Policy</Link> and <Link to="/terms" target="_blank">Terms of Use</Link>.</span>
        </label>
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={!agree || busy} onClick={accept}>
          {busy ? "Saving…" : "Agree and continue"}
        </button>
        <p className="small" style={{ marginBottom: 0 }}><button type="button" className="linklike" onClick={signOut}>Don't agree — sign out</button></p>
      </div>
    </main>
  );
}
