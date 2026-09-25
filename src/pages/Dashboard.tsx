import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, STAGES, type ClientOverview, type Workload } from "../lib/supabase";
import { HealthBadge, Loading, Progress, StageBadge, Empty } from "../components/ui";
import { byCode, daysLeftText, todayISO } from "../lib/format";
import { useRefreshOnFocus } from "../lib/useRefresh";

export default function Dashboard() {
  const [clients, setClients] = useState<ClientOverview[] | null>(null);
  const [team, setTeam] = useState<Workload[]>([]);
  const nav = useNavigate();

  const load = useCallback(() => {
    supabase.from("client_overview").select("*").then(({ data }) => setClients(((data as ClientOverview[]) ?? []).sort(byCode)));
    supabase.from("employee_workload").select("*").eq("is_active", true).order("full_name").then(({ data }) => setTeam((data as Workload[]) ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);

  const stats = useMemo(() => {
    const c = clients ?? [];
    const active = c.filter((x) => x.stage !== "completed");
    return {
      active: active.length,
      delayed: active.filter((x) => x.is_delayed).length,
      onTime: active.filter((x) => !x.is_delayed && !x.is_on_hold).length,
      awaiting: active.filter((x) => x.stage === "client_review" || x.stage === "final_approval").length,
      avg: active.length ? Math.round(active.reduce((s, x) => s + x.progress_pct, 0) / active.length) : 0,
      byStage: STAGES.map((s) => ({ ...s, count: c.filter((x) => x.stage === s.key).length })),
    };
  }, [clients]);

  if (!clients) return <Loading />;
  const delayed = clients.filter((c) => c.is_delayed).sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0));
  const maxStage = Math.max(1, ...stats.byStage.map((s) => s.count));

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Every client's progress, and who's running late.</p></div>
        <Link className="btn primary" to="/clients?new=1">+ New client</Link>
      </div>

      <div className="grid kpis mb">
        <div className="card kpi"><div className="label">Active clients</div><div className="value">{stats.active}</div></div>
        <div className="card kpi ok"><div className="label">On time</div><div className="value">{stats.onTime}</div></div>
        <div className="card kpi bad"><div className="label">Delayed</div><div className="value">{stats.delayed}</div></div>
        <div className="card kpi"><div className="label">Waiting on client</div><div className="value">{stats.awaiting}</div></div>
        <div className="card kpi"><div className="label">Avg. progress</div><div className="value">{stats.avg}%</div></div>
      </div>

      <div className="grid side">
        <div className="card">
          <div className="card-head"><h2>Delayed clients</h2><span className="badge bad">{delayed.length}</span></div>
          {delayed.length === 0 ? <Empty>Nothing is running late. 🎉</Empty> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Client</th><th>Stage</th><th>Owner</th><th>Why late</th><th>Overdue tasks</th></tr></thead>
              <tbody>
                {delayed.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => nav(`/clients/${c.id}`)}>
                    <td><b>#{c.client_code}</b> {c.company_name}</td>
                    <td><StageBadge stage={c.stage} /></td>
                    <td>{c.employee_name ?? <span className="muted">Unassigned</span>}</td>
                    <td><span className="badge bad">{lateReason(c)}</span></td>
                    <td>{c.overdue_tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        <div className="card">
          <h2 className="mb">Clients by stage</h2>
          {stats.byStage.map((s) => (
            <div key={s.key} style={{ marginBottom: 10 }}>
              <div className="row small" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                <span>{s.label}</span><b>{s.count}</b>
              </div>
              <Progress pct={(s.count / maxStage) * 100} tone={s.key === "completed" ? "ok" : undefined} />
            </div>
          ))}
        </div>
      </div>

      <div className="card mt">
        <div className="card-head"><h2>All clients</h2><Link to="/clients">Open clients →</Link></div>
        {clients.length === 0 ? <Empty>No clients yet. <Link to="/clients?new=1">Add your first client</Link>.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Client</th><th>Stage</th><th style={{ width: 180 }}>Progress</th><th>Owner</th><th>Status</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => nav(`/clients/${c.id}`)}>
                  <td><b>#{c.client_code}</b> {c.company_name}</td>
                  <td><StageBadge stage={c.stage} /></td>
                  <td><div className="row"><Progress pct={c.progress_pct} tone={c.is_delayed ? "bad" : c.stage === "completed" ? "ok" : undefined} /><span className="small muted">{c.progress_pct}%</span></div></td>
                  <td>{c.employee_name ?? <span className="muted">—</span>}</td>
                  <td><HealthBadge delayed={c.is_delayed} onHold={c.is_on_hold} completed={c.stage === "completed"} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card mt">
        <div className="card-head"><h2>Team workload</h2><Link to="/employees">Open team →</Link></div>
        {team.length === 0 ? <Empty>No team members yet.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Active clients</th><th>Open tasks</th><th>Overdue</th><th>Done (7 days)</th></tr></thead>
            <tbody>
              {team.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => nav(`/employees/${t.id}`)}>
                  <td><b>{t.full_name || t.email}</b> <span className="muted small">{t.designation}</span></td>
                  <td>{t.active_clients}</td><td>{t.open_tasks}</td>
                  <td>{t.overdue_tasks > 0 ? <span className="badge bad">{t.overdue_tasks}</span> : 0}</td>
                  <td>{t.done_last_7d}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

function lateReason(c: ClientOverview) {
  if (c.days_left !== null && c.days_left < 0) return `Stage ${daysLeftText(c.days_left)}`;
  if (c.plan_end && c.plan_end < todayISO()) return "Plan deadline passed";
  if (c.overdue_tasks > 0) return c.overdue_tasks === 1 ? "1 task overdue" : `${c.overdue_tasks} tasks overdue`;
  return "Late";
}
