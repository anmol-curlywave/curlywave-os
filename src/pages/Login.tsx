import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup" | "forgot";

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(() => {
    // Expired/invalid links from Supabase emails come back as #error_description=...
    const h = new URLSearchParams(window.location.hash.slice(1));
    const d = h.get("error_description");
    if (d) { history.replaceState(null, "", window.location.pathname); return { ok: false, text: d.replace(/\+/g, " ") + ". Please request a new link." }; }
    return null;
  });

  function go(m: Mode) { setMode(m); setMsg(null); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const mail = email.trim();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (error) setMsg({ ok: false, text: friendly(error.message) });
    } else if (mode === "signup") {
      if (password.length < 8) { setMsg({ ok: false, text: "Password must be at least 8 characters." }); setBusy(false); return; }
      const { data, error } = await supabase.auth.signUp({
        email: mail, password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
      });
      if (error) setMsg({ ok: false, text: error.message });
      else if (!data.session) setMsg({ ok: true, text: "Account created. Check your email for the confirmation link, then sign in." });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin + import.meta.env.BASE_URL });
      setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "If that email has a login, a reset link is on its way." });
    }
    setBusy(false);
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ["Sign in", "Use the email and password your Curlywave admin gave you."],
    signup: ["Create account", "New accounts need an admin to approve them before they can see anything."],
    forgot: ["Reset password", "We'll email you a reset link."],
  };

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand" style={{ padding: "0 0 14px" }}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /> Curlywave OS</div>
        <h1 style={{ marginBottom: 4 }}>{titles[mode][0]}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{titles[mode][1]}</p>
        {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== "forgot" && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
        <div className="row small" style={{ justifyContent: "space-between", marginTop: 14 }}>
          {mode !== "signin"
            ? <a href="#" onClick={(e) => { e.preventDefault(); go("signin"); }}>Back to sign in</a>
            : <>
                <a href="#" onClick={(e) => { e.preventDefault(); go("forgot"); }}>Forgot password?</a>
                <a href="#" onClick={(e) => { e.preventDefault(); go("signup"); }}>Create account</a>
              </>}
        </div>
      </form>
    </div>
  );
}

function friendly(m: string) {
  if (m === "Invalid login credentials") return "Wrong email or password.";
  if (/banned/i.test(m)) return "Your login has been disabled. Contact your Curlywave admin.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first — check your inbox for the link.";
  if (/fetch|network/i.test(m)) return "Can't reach the server. Check your internet connection.";
  return m;
}
