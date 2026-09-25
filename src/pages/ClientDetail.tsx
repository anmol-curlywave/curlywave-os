import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase, STAGES, type ClientOverview, type Profile, type Stage, type Task, adminUsers } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { HealthBadge, Loading, Modal, Progress, StageBadge, Stepper, Empty } from "../components/ui";
import ClientForm from "../components/ClientForm";
import TaskForm from "../components/TaskForm";
import TaskTable from "../components/TaskTable";
import { byTaskPriority, daysLeftText, fmtDate, fmtDateTime, randomPassword } from "../lib/format";
import { useRefreshOnFocus } from "../lib/useRefresh";

interface Rule { id: string; rule: string; category: string; created_at: string }
interface Activity { id: number; action: string; details: Record<string, string | null>; created_at: string; actor_id: string | null }

export default function ClientDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [c, setC] = useState<ClientOverview | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"overview" | "tasks" | "rules" | "activity" | "portal">("overview");
  const [editing, setEditing] = useState(false);
  const [taskModal, setTaskModal] = useState<Task | "new" | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [cl, t, r, a, p] = await Promise.all([
      supabase.from("client_overview").select("*").eq("id", id!).maybeSingle(),
      supabase.from("tasks").select("*").eq("client_id", id!),
      supabase.from("client_rules").select("*").eq("client_id", id!).order("created_at"),
      supabase.from("activity_log").select("*").eq("client_id", id!).order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("id,full_name,email"),
    ]);
    setC((cl.data as ClientOverview) ?? null);
    setTasks(((t.data as Task[]) ?? []).sort(byTaskPriority));
    setRules((r.data as Rule[]) ?? []);
    setActivity((a.data as Activity[]) ?? []);
    setNames(Object.fromEntries(((p.data as Profile[]) ?? []).map((x) => [x.id, x.full_name || x.email])));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);

  async function moveStage(stage: Stage) {
    setErr("");
    const { error } = await supabase.from("clients").update({ stage }).eq("id", id!);
    if (error) setErr(error.message); else load();
  }

  if (c === undefined) return <Loading />;
  if (c === null) return <Empty>Client not found, or you don't have access. <Link to="/clients">Back to clients</Link></Empty>;

  const idx = STAGES.findIndex((s) => s.key === c.stage);
  const prev = STAGES[idx - 1];
  const next = STAGES[idx + 1];
  const openTasks = tasks.filter((t) => t.status !== "done");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small muted"><Link to="/clients">Clients</Link> / #{c.client_code}</div>
          <h1>{c.company_name}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <StageBadge stage={c.stage} label={c.stage_label} />
            <HealthBadge delayed={c.is_delayed} onHold={c.is_on_hold} completed={c.stage === "completed"} />
            <span className="muted small">Owner: {c.employee_name ?? "Unassigned"}</span>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setEditing(true)}>Edit details</button>
        </div>
      </div>

      {err && <div className="alert">{err}</div>}

      <div className="card mb">
        <div className="card-head">
          <h2>Pipeline</h2>
          <div className="row">
            {prev && <button className="btn sm" onClick={() => moveStage(prev.key)}>← {prev.label}</button>}
            {next && <button className="btn sm primary" onClick={() => moveStage(next.key)}>Move to {next.label} →</button>}
          </div>
        </div>
        <Stepper stage={c.stage} />
        <div className="row mt small">
          <div style={{ width: 200 }}><Progress pct={c.progress_pct} tone={c.is_delayed ? "bad" : c.stage === "completed" ? "ok" : undefined} /></div>
          <b>{c.progress_pct}%</b>
          <span className="muted">· In this stage since {fmtDate(c.stage_started_at)}</span>
          <span className="muted">· Stage due {fmtDate(c.stage_due_date)} ({daysLeftText(c.days_left)})</span>
        </div>
      </div>

      <div className="tabs">
        {([["overview", "Overview"], ["tasks", `Tasks (${openTasks.length})`], ["rules", `Rules (${rules.length})`], ["activity", "Activity"],
          ...(isAdmin ? [["portal", "Client login"]] : [])] as [typeof tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid two">
          <div className="card">
            <h2 className="mb">Contact & brand</h2>
            <dl className="kv">
              <dt>Contact</dt><dd>{c.contact_name ?? "—"}</dd>
              <dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd>
              <dt>Phone</dt><dd>{c.phone ?? "—"}</dd>
              <dt>WhatsApp</dt><dd>{c.whatsapp ?? "—"}</dd>
              <dt>Industry</dt><dd>{c.industry ?? "—"}</dd>
              <dt>City</dt><dd>{c.city ?? "—"}</dd>
              <dt>Website</dt><dd>{c.website ? <a href={c.website} target="_blank" rel="noreferrer">{c.website}</a> : "—"}</dd>
              <dt>Instagram</dt><dd>{c.instagram ?? "—"}</dd>
              <dt>Facebook</dt><dd>{c.facebook ?? "—"}</dd>
              <dt>LinkedIn</dt><dd>{c.linkedin ?? "—"}</dd>
              <dt>YouTube</dt><dd>{c.youtube ?? "—"}</dd>
              <dt>X</dt><dd>{c.x_handle ?? "—"}</dd>
            </dl>
          </div>
          <div className="card">
            <h2 className="mb">Plan</h2>
            <dl className="kv">
              <dt>Plan</dt><dd>{c.plan_name ?? "—"}</dd>
              <dt>Posts</dt><dd>{c.static_posts} static · {c.video_posts} video · {c.carousel_posts} carousel</dd>
              <dt>Language</dt><dd>{c.language}</dd>
              <dt>Start</dt><dd>{fmtDate(c.plan_start)}</dd>
              <dt>Deadline</dt><dd>{fmtDate(c.plan_end)}</dd>
              <dt>Drive folder</dt><dd>{c.drive_folder_url ? <a href={c.drive_folder_url} target="_blank" rel="noreferrer">Open folder</a> : "—"}</dd>
              <dt>Content plan</dt><dd>{c.content_plan_url ? <a href={c.content_plan_url} target="_blank" rel="noreferrer">Open plan</a> : "—"}</dd>
              <dt>On hold</dt><dd>{c.is_on_hold ? "Yes" : "No"}</dd>
            </dl>
            {c.notes && <><h3 className="mt">Internal notes</h3><p style={{ whiteSpace: "pre-wrap" }}>{c.notes}</p></>}
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="card">
          <div className="card-head"><h2>Tasks</h2><button className="btn primary sm" onClick={() => setTaskModal("new")}>+ Add task</button></div>
          <TaskTable tasks={tasks} names={names} hideClient onEdit={(t) => setTaskModal(t)} onChanged={load} />
        </div>
      )}

      {tab === "rules" && <Rules clientId={c.id} rules={rules} isAdmin={isAdmin} onChanged={load} />}

      {tab === "activity" && (
        <div className="card">
          <h2 className="mb">Activity</h2>
          {activity.length === 0 ? <Empty>No activity yet.</Empty> : (
            <ul className="list">
              {activity.map((a) => (
                <li key={a.id}>
                  <span className="small muted" style={{ minWidth: 120 }}>{fmtDateTime(a.created_at)}</span>
                  <span>
                    <b>{a.actor_id ? names[a.actor_id] ?? "Someone" : "System"}</b>{" "}
                    {describe(a, names)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "portal" && isAdmin && <PortalLogin client={c} names={names} onChanged={load} />}

      {editing && <ClientForm client={c} isAdmin={isAdmin} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {taskModal && (
        <TaskForm task={taskModal === "new" ? undefined : taskModal} clientId={c.id}
          onClose={() => setTaskModal(null)} onSaved={() => { setTaskModal(null); load(); }} />
      )}
    </>
  );
}

function describe(a: Activity, names: Record<string, string>) {
  const st = (k?: string | null) => STAGES.find((s) => s.key === k)?.label ?? k ?? "—";
  switch (a.action) {
    case "client_created": return "created this client";
    case "stage_changed": return <>moved the stage from <b>{st(a.details.from)}</b> to <b>{st(a.details.to)}</b></>;
    case "client_reassigned": return <>reassigned the client to <b>{a.details.to ? names[a.details.to] ?? "someone" : "nobody"}</b></>;
    case "task_status": return <>marked “{a.details.title}” as <b>{a.details.to?.replace("_", " ")}</b></>;
    default: return a.action;
  }
}

function Rules({ clientId, rules, isAdmin, onChanged }: { clientId: string; rules: Rule[]; isAdmin: boolean; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState("general");
  const [err, setErr] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const { error } = await supabase.from("client_rules").insert({ client_id: clientId, rule: text.trim(), category: cat });
    if (error) setErr(error.message); else { setText(""); onChanged(); }
  }
  async function del(id: string) {
    if (!confirm("Delete this rule?")) return;
    const { error } = await supabase.from("client_rules").delete().eq("id", id);
    if (error) setErr(error.message); else onChanged();
  }

  return (
    <div className="card">
      <h2>Client rules</h2>
      <p className="muted small">Standing instructions for this client (brand name, banned claims, colours, language…). Every AI step will follow these automatically.</p>
      {err && <div className="alert">{err}</div>}
      <form onSubmit={add} className="row mb">
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 150 }}>
          <option value="general">General</option><option value="brand">Brand</option><option value="content">Content</option>
          <option value="visual">Visual</option><option value="video">Video</option><option value="compliance">Compliance</option>
        </select>
        <input style={{ flex: 1, minWidth: 220 }} placeholder='e.g. Never say "cure"; brand name is always "Tiwari Motors"' value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn primary">Add rule</button>
      </form>
      {rules.length === 0 ? <Empty>No rules yet.</Empty> : (
        <ul className="list">
          {rules.map((r) => (
            <li key={r.id}>
              <span className="badge brand">{r.category}</span>
              <span style={{ flex: 1 }}>{r.rule}</span>
              {isAdmin && <button className="btn sm danger" onClick={() => del(r.id)}>Delete</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PortalLogin({ client, names, onChanged }: { client: ClientOverview; names: Record<string, string>; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(client.email ?? "");
  const [name, setName] = useState(client.contact_name ?? "");
  const [password, setPassword] = useState(randomPassword());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await adminUsers({ action: "create", email, password, full_name: name, role: "client", client_id: client.id });
      setMsg({ ok: true, text: `Login created. Send the client: ${email} / ${password}` });
      setOpen(false);
      onChanged();
    } catch (e2) { setMsg({ ok: false, text: (e2 as Error).message }); }
    setBusy(false);
  }

  async function unlink() {
    if (!confirm("Remove this client's portal access? (Their login stays but sees nothing.)")) return;
    const { error } = await supabase.from("clients").update({ portal_user_id: null }).eq("id", client.id);
    if (error) setMsg({ ok: false, text: error.message }); else onChanged();
  }

  return (
    <div className="card">
      <h2>Client portal login</h2>
      <p className="muted small">The client uses this login to see their project progress. Plan approval, change requests and the chatbot will also appear here in later phases.</p>
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
      {client.portal_user_id ? (
        <div className="row">
          <span>Linked login: <b>{names[client.portal_user_id] ?? "Client user"}</b></span>
          <button className="btn sm danger" onClick={unlink}>Remove access</button>
        </div>
      ) : (
        <button className="btn primary" onClick={() => setOpen(true)}>Create client login</button>
      )}
      {open && (
        <Modal title="Create client login" onClose={() => setOpen(false)}
          footer={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" form="portal-form" disabled={busy}>{busy ? "Creating…" : "Create"}</button></>}>
          <form id="portal-form" onSubmit={create}>
            <div className="field"><label>Client's name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Login email *</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label>Password * (share this with the client)</label>
              <div className="row"><input required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn sm" onClick={() => setPassword(randomPassword())}>New</button></div></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
