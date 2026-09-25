import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

/** Change your own name, phone and password. Also used as the "set new password" screen after a reset email. */
export default function Account({ recoveryMode = false }: { recoveryMode?: boolean }) {
  const { profile, refreshProfile, clearRecovery, signOut } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim() || null }).eq("id", profile!.id);
    setBusy(false);
    if (error) setMsg({ ok: false, text: error.message });
    else { setMsg({ ok: true, text: "Profile saved." }); refreshProfile(); }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) { setMsg({ ok: false, text: "Password must be at least 8 characters." }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: "The two passwords don't match." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setPw(""); setPw2("");
    setMsg({ ok: true, text: "Password changed." });
    if (recoveryMode) clearRecovery();
  }

  const pwForm = (
    <form onSubmit={savePassword}>
      <div className="field"><label htmlFor="pw1">New password</label>
        <input id="pw1" type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <div className="field"><label htmlFor="pw2">Repeat new password</label>
        <input id="pw2" type="password" autoComplete="new-password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
    </form>
  );

  if (recoveryMode) {
    return (
      <div className="center-screen">
        <div className="card auth-card">
          <div className="brand" style={{ padding: "0 0 14px" }}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /> Curlywave OS</div>
          <h1 style={{ marginBottom: 4 }}>Set a new password</h1>
          <p className="muted" style={{ marginTop: 0 }}>Choose a new password for {profile?.email ?? "your account"}.</p>
          {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
          {pwForm}
          <p className="small" style={{ marginBottom: 0 }}><a href="#" onClick={(e) => { e.preventDefault(); clearRecovery(); signOut(); }}>Cancel and sign out</a></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head"><div><h1>My account</h1><p>{profile?.email} · <span style={{ textTransform: "capitalize" }}>{profile?.role}</span></p></div></div>
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
      <div className="grid two">
        <div className="card">
          <h2 className="mb">Profile</h2>
          <form onSubmit={saveProfile}>
            <div className="field"><label htmlFor="acc-name">Full name</label><input id="acc-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="acc-phone">Phone</label><input id="acc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <button className="btn primary" disabled={busy}>Save profile</button>
          </form>
        </div>
        <div className="card">
          <h2 className="mb">Change password</h2>
          {pwForm}
        </div>
      </div>
    </>
  );
}
