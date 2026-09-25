import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, adminUsers, type Profile, type Workload } from "../lib/supabase";
import { Empty, Loading, Modal } from "../components/ui";
import { randomPassword } from "../lib/format";

export default function Employees() {
  const [team, setTeam] = useState<Workload[] | null>(null);
  const [pending, setPending] = useState<Profile[]>([]);
  const [clientsUsers, setClientUsers] = useState<Profile[]>([]);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nav = useNavigate();

  const load = useCallback(async () => {
    const [w, p] = await Promise.all([
      supabase.from("employee_workload").select("*").order("full_name"),
      supabase.from("profiles").select("*").in("role", ["pending", "client"]).order("created_at", { ascending: false }),
    ]);
    setTeam((w.data as Workload[]) ?? []);
    const others = (p.data as Profile[]) ?? [];
    setPending(others.filter((x) => x.role === "pending"));
    setClientUsers(others.filter((x) => x.role === "client"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function approve(u: Profile, role: "employee" | "client") {
    try { await adminUsers({ action: "update", user_id: u.id, role }); setMsg({ ok: true, text: `${u.email} is now ${role}.` }); load(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }

  if (!team) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div><h1>Team</h1><p>Who is working on what, and what's slipping.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add team member</button>
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}

      {pending.length > 0 && (
        <div className="card mb">
          <h2 className="mb">Waiting for approval ({pending.length})</h2>
          <ul className="list">
            {pending.map((u) => (
              <li key={u.id} style={{ alignItems: "center" }}>
                <span style={{ flex: 1 }}><b>{u.full_name || "—"}</b> <span className="muted">{u.email}</span></span>
                <button className="btn sm" onClick={() => approve(u, "employee")}>Approve as employee</button>
                <button className="btn sm" onClick={() => approve(u, "client")}>Approve as client</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        {team.length === 0 ? <Empty>No team members yet.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Role</th><th>Active clients</th><th>Open tasks</th><th>In progress</th><th>Overdue</th><th>Done (7 days)</th><th>Status</th></tr></thead>
            <tbody>
              {team.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => nav(`/employees/${t.id}`)}>
                  <td><b>{t.full_name || t.email}</b><div className="small muted">{t.designation ?? t.email}</div></td>
                  <td style={{ textTransform: "capitalize" }}>{t.role}</td>
                  <td>{t.active_clients}</td>
                  <td>{t.open_tasks}</td>
                  <td>{t.in_progress_tasks}</td>
                  <td>{t.overdue_tasks > 0 ? <span className="badge bad">{t.overdue_tasks}</span> : 0}</td>
                  <td>{t.done_last_7d}</td>
                  <td>{t.is_active ? <span className="badge ok">Active</span> : <span className="badge">Disabled</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {clientsUsers.length > 0 && (
        <div className="card mt">
          <h2 className="mb">Client logins ({clientsUsers.length})</h2>
          <ul className="list">
            {clientsUsers.map((u) => (
              <li key={u.id} style={{ alignItems: "center" }}>
                <span style={{ flex: 1 }}><b>{u.full_name || "—"}</b> <span className="muted">{u.email}</span>{!u.is_active && <span className="badge">Disabled</span>}</span>
                <button className="btn sm" onClick={() => nav(`/employees/${u.id}`)}>Manage login</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {adding && <AddMember onClose={() => setAdding(false)} onDone={(text) => { setAdding(false); setMsg({ ok: true, text }); load(); }} />}
    </>
  );
}

function AddMember({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [f, setF] = useState({ full_name: "", email: "", password: randomPassword(), role: "employee", designation: "", phone: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await adminUsers({ action: "create", ...f });
      onDone(`Login created for ${f.full_name}. Share: ${f.email} / ${f.password}`);
    } catch (e2) { setErr((e2 as Error).message); }
    setBusy(false);
  }

  return (
    <Modal title="Add team member" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="member-form" disabled={busy}>{busy ? "Creating…" : "Create login"}</button></>}>
      {err && <div className="alert">{err}</div>}
      <form id="member-form" onSubmit={submit} className="form-grid">
        <div className="field"><label>Full name *</label><input required value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
        <div className="field"><label>Email *</label><input type="email" required value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div className="field"><label>Role</label>
          <select value={f.role} onChange={(e) => set("role", e.target.value)}>
            <option value="employee">Employee</option><option value="admin">Admin</option>
          </select></div>
        <div className="field"><label>Designation</label><input placeholder="e.g. Content writer" value={f.designation} onChange={(e) => set("designation", e.target.value)} /></div>
        <div className="field"><label>Phone</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div className="field"><label>Password * (share with them)</label>
          <div className="row"><input required minLength={8} value={f.password} onChange={(e) => set("password", e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn sm" onClick={() => set("password", randomPassword())}>New</button></div></div>
      </form>
    </Modal>
  );
}
