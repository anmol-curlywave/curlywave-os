import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Field } from "../components/ui";
import { Link } from "react-router-dom";
import { fmtDateTime } from "../lib/format";

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
          <p className="small" style={{ marginBottom: 0 }}><button type="button" className="linklike" onClick={() => { clearRecovery(); signOut(); }}>Cancel and sign out</button></p>
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
            <Field label="Full name"><input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Phone"><input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <button className="btn primary" disabled={busy}>Save profile</button>
          </form>
        </div>
        <div className="card">
          <h2 className="mb">Change password</h2>
          {pwForm}
        </div>
      </div>
      <PrivacyCard />
    </>
  );
}

/** DPDP Act rights: get a copy of your data, or ask for it to be deleted. */
function PrivacyCard() {
  const { profile, refreshProfile } = useAuth();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const requested = profile?.deletion_requested_at;

  async function download() {
    setBusy(true); setMsg(null);
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), profile };
    if (profile?.role === "client") {
      out.projects = (await supabase.rpc("my_projects")).data ?? [];
    } else {
      out.tasks_assigned_to_me = (await supabase.from("tasks").select("*").eq("assignee_id", profile!.id)).data ?? [];
      out.my_activity = (await supabase.from("activity_log").select("*").eq("actor_id", profile!.id).limit(5000)).data ?? [];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `curlywave-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setBusy(false);
    setMsg({ ok: true, text: "Your data file has been downloaded." });
  }

  async function setDeletion(on: boolean) {
    if (on && !confirm("Ask Curlywave to delete your personal data?\n\nAn admin will disable your login and remove your details. This can't be undone once they act on it.")) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("profiles").update({ deletion_requested_at: on ? new Date().toISOString() : null }).eq("id", profile!.id);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /deletion_requested_at/.test(error.message) ? "This isn't switched on yet — please email us instead (see the Privacy Policy)." : error.message }); return; }
    setMsg({ ok: true, text: on ? "Request sent. An admin will act on it and confirm with you." : "Deletion request cancelled." });
    refreshProfile();
  }

  return (
    <div className="card mt">
      <h2 className="mb">Your data & privacy</h2>
      <p className="muted small">
        See how we use your data in the <Link to="/privacy">Privacy Policy</Link>.
        {profile?.consent_at ? ` You agreed on ${fmtDateTime(profile.consent_at)}.` : ""}
      </p>
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`} role="status">{msg.text}</div>}
      {requested && <div className="alert">You asked for your data to be deleted on {fmtDateTime(requested)}. An admin will act on it.</div>}
      <div className="row">
        <button className="btn" disabled={busy} onClick={download}>Download my data</button>
        {requested
          ? <button className="btn" disabled={busy} onClick={() => setDeletion(false)}>Cancel deletion request</button>
          : <button className="btn danger" disabled={busy} onClick={() => setDeletion(true)}>Request deletion</button>}
      </div>
    </div>
  );
}
