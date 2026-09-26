import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase, STAGES, type ClientOverview } from "../lib/supabase";
import Icon from "../components/Icon";
import { useAuth } from "../lib/auth";
import { Avatar, Empty, HealthBadge, Loading, Progress, StageBadge, rowLink } from "../components/ui";
import ClientForm from "../components/ClientForm";
import { byCode, daysLeftText } from "../lib/format";
import { useRefreshOnFocus } from "../lib/useRefresh";

export default function Clients() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState<ClientOverview[] | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");
  const [health, setHealth] = useState("");
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const showNew = params.get("new") === "1";

  const load = useCallback(() => {
    supabase.from("client_overview").select("*").then(({ data }) => setRows(((data as ClientOverview[]) ?? []).sort(byCode)));
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);

  const owners = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.employee_name).filter(Boolean))) as string[], [rows]);
  const filtered = useMemo(() => (rows ?? []).filter((r) => {
    const text = `${r.client_code} ${r.company_name} ${r.contact_name ?? ""} ${r.city ?? ""} ${r.industry ?? ""}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (stage && r.stage !== stage) return false;
    if (owner && (owner === "__none" ? r.employee_name : r.employee_name !== owner)) return false;
    if (health === "delayed" && !r.is_delayed) return false;
    if (health === "ontime" && (r.is_delayed || r.is_on_hold || r.stage === "completed")) return false;
    if (health === "hold" && !r.is_on_hold) return false;
    return true;
  }), [rows, q, stage, owner, health]);

  if (!rows) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div><h1>{isAdmin ? "Clients" : "My clients"}</h1><p>{filtered.length} of {rows.length} clients</p></div>
        {isAdmin && <button className="btn primary" onClick={() => setParams({ new: "1" })}><Icon name="plus" size={16} />New client</button>}
      </div>

      <div className="card">
        <div className="row filters mb">
          <input className="search" aria-label="Search clients" type="search" placeholder="Search name, code, city…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Filter by stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {isAdmin && (
            <select aria-label="Filter by owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">All owners</option>
              <option value="__none">Unassigned</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          <select aria-label="Filter by status" value={health} onChange={(e) => setHealth(e.target.value)}>
            <option value="">Any status</option>
            <option value="delayed">Delayed</option>
            <option value="ontime">On time</option>
            <option value="hold">On hold</option>
          </select>
        </div>

        {filtered.length === 0 ? <Empty icon="search">No clients match these filters. Try clearing the search or filters.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Code</th><th>Client</th><th>Stage</th><th style={{ width: 170 }}>Progress</th><th>Stage due</th>{isAdmin && <th>Owner</th>}<th>Open tasks</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} {...rowLink(() => nav(`/clients/${c.id}`))}>
                  <td><b>#{c.client_code}</b></td>
                  <td className="name-cell">{c.company_name}<div className="small muted">{[c.industry, c.city].filter(Boolean).join(" · ")}</div></td>
                  <td><StageBadge stage={c.stage} /></td>
                  <td><div className="row"><Progress pct={c.progress_pct} tone={c.is_delayed ? "bad" : c.stage === "completed" ? "ok" : undefined} /><span className="small muted">{c.progress_pct}%</span></div></td>
                  <td className={c.days_left !== null && c.days_left < 0 ? "" : "muted"}>{daysLeftText(c.days_left)}</td>
                  {isAdmin && <td>{c.employee_name ? <span className="person"><Avatar name={c.employee_name} size={24} />{c.employee_name}</span> : <span className="muted">—</span>}</td>}
                  <td>{c.open_tasks}{c.overdue_tasks > 0 && <span className="badge bad" style={{ marginLeft: 6 }}>{c.overdue_tasks} late</span>}</td>
                  <td><HealthBadge delayed={c.is_delayed} onHold={c.is_on_hold} completed={c.stage === "completed"} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showNew && isAdmin && (
        <ClientForm isAdmin onClose={() => setParams({})} onSaved={(id) => nav(`/clients/${id}`)} />
      )}
    </>
  );
}
