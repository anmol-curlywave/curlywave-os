import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, adminUsers, type ClientOverview, type Profile, type Task, type Workload } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Avatar, Empty, HealthBadge, Kpi, Loading, Progress, StageBadge, rowLink } from "../components/ui";
import TaskTable from "../components/TaskTable";
import TaskForm from "../components/TaskForm";
import { byCode, byTaskPriority, fmtDateTime, randomPassword } from "../lib/format";

export default function EmployeeDetail() {
  const { id } = useParams();
  const { profile: me } = useAuth();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [w, setW] = useState<Workload | null>(null);
  const [clients, setClients] = useState<ClientOverview[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<Task | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nav = useNavigate();

  const load = useCallback(async () => {
    const [pr, wl, cl, tk, all, allc] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id!).maybeSingle(),
      supabase.from("employee_workload").select("*").eq("id", id!).maybeSingle(),
      supabase.from("client_overview").select("*").eq("assigned_employee_id", id!),
      supabase.from("tasks").select("*").eq("assignee_id", id!).neq("status", "done").order("due_date", { nullsFirst: false }),
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("clients").select("id,client_code,company_name"),
    ]);
    setP((pr.data as Profile) ?? null);
    setW((wl.data as Workload) ?? null);
    setClients(((cl.data as ClientOverview[]) ?? []).sort(byCode));
    setTasks(((tk.data as Task[]) ?? []).sort(byTaskPriority));
    setNames(Object.fromEntries(((all.data as Profile[]) ?? []).map((x) => [x.id, x.full_name || x.email])));
    setClientNames(Object.fromEntries((allc.data ?? []).map((x) => [x.id, `#${x.client_code} ${x.company_name}`])));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>, ok: string) {
    setMsg(null);
    try { await adminUsers({ user_id: id, ...body }); setMsg({ ok: true, text: ok }); load(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }

  if (p === undefined) return <Loading />;
  if (p === null) return <Empty>Not found. <Link to="/employees">Back</Link></Empty>;
  const self = me?.id === p.id;
  const late = clients.filter((c) => c.is_delayed);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small muted"><Link to="/employees">Team</Link> / {p.full_name || p.email}</div>
          <h1 className="person" style={{ gap: 12 }}><Avatar name={p.full_name || p.email} size={40} />{p.full_name || p.email}</h1>
          <p>{p.designation ?? "—"} · {p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
        </div>
        {!self && (
          <div className="row">
            <select aria-label="Role" value={p.role} style={{ width: "auto" }} onChange={(e) => {
              const role = e.target.value;
              const what: Record<string, string> = {
                admin: "ADMIN — full access to every client, the team and settings",
                employee: "EMPLOYEE — sees only their assigned clients and tasks",
                client: "CLIENT — sees only their own project in the portal",
              };
              if (confirm(`Change ${p.email} to ${what[role]}?`)) act({ action: "update", role }, "Role updated.");
              else e.target.value = p.role;
            }}>
              <option value="employee">Employee</option><option value="admin">Admin</option><option value="client">Client</option>
            </select>
            <button className="btn" onClick={() => {
              const pw = randomPassword();
              if (confirm(`Set a new password for ${p.email}?\n\nNew password: ${pw}`)) act({ action: "reset_password", password: pw }, `New password for ${p.email}: ${pw}`);
            }}>Reset password</button>
            <button className={`btn ${p.is_active ? "danger" : ""}`}
              onClick={() => {
                if (p.is_active && !confirm(`Disable ${p.email}? They will be signed out and can't log in until you enable them again.`)) return;
                act({ action: "update", is_active: !p.is_active }, p.is_active ? "Login disabled." : "Login enabled.");
              }}>
              {p.is_active ? "Disable login" : "Enable login"}
            </button>
          </div>
        )}
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`} role="status">{msg.text}</div>}
      {p.deletion_requested_at && (
        <div className="alert">
          <b>Asked for their data to be deleted</b> on {fmtDateTime(p.deletion_requested_at)}. Disable the login, remove or anonymise their personal details, then let them know.
        </div>
      )}
      {"consent_version" in p && (
        <p className="small muted">Privacy consent: {p.consent_at ? `agreed ${fmtDateTime(p.consent_at)} (version ${p.consent_version})` : "not given yet — they'll be asked at their next sign-in"}</p>
      )}

      {w && (
        <div className="grid kpis mb">
          <Kpi icon="clients" label="Active clients" value={w.active_clients} />
          <Kpi icon="list" label="Open tasks" value={w.open_tasks} />
          <Kpi icon="trend" tone="info" label="In progress" value={w.in_progress_tasks} />
          <Kpi icon="alert" tone="bad" label="Overdue tasks" value={w.overdue_tasks} />
          <Kpi icon="check" tone="ok" label="Done (7 days)" value={w.done_last_7d} />
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>Clients handled ({clients.length})</h2>{late.length > 0 && <span className="badge bad">{late.length} delayed</span>}</div>
        {clients.length === 0 ? <Empty>No clients assigned.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Client</th><th>Stage</th><th style={{ width: 170 }}>Progress</th><th>Open tasks</th><th>Status</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} {...rowLink(() => nav(`/clients/${c.id}`))}>
                  <td><b>#{c.client_code}</b> {c.company_name}</td>
                  <td><StageBadge stage={c.stage} /></td>
                  <td><div className="row"><Progress pct={c.progress_pct} tone={c.is_delayed ? "bad" : undefined} /><span className="small muted">{c.progress_pct}%</span></div></td>
                  <td>{c.open_tasks}{c.overdue_tasks > 0 && <span className="badge bad" style={{ marginLeft: 6 }}>{c.overdue_tasks} late</span>}</td>
                  <td><HealthBadge delayed={c.is_delayed} onHold={c.is_on_hold} completed={c.stage === "completed"} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2 className="mb">Pending work ({tasks.length})</h2>
        <TaskTable tasks={tasks} names={names} clientNames={clientNames} onEdit={setModal} onChanged={load} />
      </div>

      {modal && <TaskForm task={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}
