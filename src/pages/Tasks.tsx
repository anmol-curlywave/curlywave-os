import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { supabase, TASK_STATUSES, type Profile, type Task, type TaskStatus } from "../lib/supabase";
import Icon from "../components/Icon";
import { useAuth } from "../lib/auth";
import { Kpi, Loading, PriorityBadge } from "../components/ui";
import TaskForm from "../components/TaskForm";
import TaskTable from "../components/TaskTable";
import { byTaskPriority, fmtDate, isOverdue, todayISO } from "../lib/format";
import { useRefreshOnFocus } from "../lib/useRefresh";

export default function Tasks({ mine = false }: { mine?: boolean }) {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<[string, string][]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [view, setView] = useState<"list" | "board">("list");
  const [assignee, setAssignee] = useState(mine ? profile!.id : "");
  const [client, setClient] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [onlyLate, setOnlyLate] = useState(false);
  const [modal, setModal] = useState<Task | "new" | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const load = useCallback(async () => {
    const [t, p, c] = await Promise.all([
      supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(2000),
      supabase.from("profiles").select("id,full_name,email,role"),
      supabase.from("clients").select("id,client_code,company_name"),
    ]);
    setTasks(((t.data as Task[]) ?? []).sort(byTaskPriority));
    const ppl = (p.data as Profile[]) ?? [];
    setNames(Object.fromEntries(ppl.map((x) => [x.id, x.full_name || x.email])));
    setStaff(ppl.filter((x) => x.role === "admin" || x.role === "employee").map((x) => [x.id, x.full_name || x.email] as [string, string]).sort((a, b) => a[1].localeCompare(b[1])));
    setClientNames(Object.fromEntries((c.data ?? []).map((x) => [x.id, `#${x.client_code} ${x.company_name}`])));
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);

  const filtered = useMemo(() => (tasks ?? []).filter((t) => {
    if (assignee && (assignee === "__none" ? t.assignee_id : t.assignee_id !== assignee)) return false;
    if (client && t.client_id !== client) return false;
    if (!showDone && view === "list" && t.status === "done") return false;
    if (onlyLate && !isOverdue(t.due_date, t.status === "done")) return false;
    return true;
  }), [tasks, assignee, client, showDone, onlyLate, view]);

  if (!tasks) return <Loading />;

  const my = tasks.filter((t) => t.assignee_id === profile!.id && t.status !== "done");
  const today = todayISO();
  const stats = {
    open: my.length,
    late: my.filter((t) => isOverdue(t.due_date, false)).length,
    today: my.filter((t) => t.due_date === today).length,
    blocked: my.filter((t) => t.status === "blocked").length,
  };

  async function move(t: Task, status: TaskStatus) {
    if (t.status === status) return;
    // Optimistic: the card jumps columns at once, then the server confirms.
    setTasks((prev) => (prev ?? []).map((x) => (x.id === t.id ? { ...x, status } : x)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
    if (error) { alert(error.message); load(); } else load();
  }

  // Drag & drop between board columns (adapted from 21st.dev "Kanban" by TomIsLoading).
  // The status dropdown on each card stays as the keyboard / single-pointer alternative.
  function onDragStart(e: DragEvent, t: Task) {
    e.dataTransfer.setData("text/task-id", t.id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    setOverCol(null);
    const id = e.dataTransfer.getData("text/task-id");
    const t = tasks?.find((x) => x.id === id);
    if (t) move(t, status);
  }

  return (
    <>
      <div className="page-head">
        <div><h1>{mine ? "My tasks" : "Tasks"}</h1><p>{mine ? `Hi ${profile?.full_name?.split(" ")[0] || "there"} — here's your work.` : "Every task across the team."}</p></div>
        <button className="btn primary" onClick={() => setModal("new")}><Icon name="plus" size={16} />New task</button>
      </div>

      {mine && (
        <div className="grid kpis mb">
          <Kpi icon="list" label="Open" value={stats.open} />
          <Kpi icon="clock" tone="warn" label="Due today" value={stats.today} />
          <Kpi icon="alert" tone="bad" label="Overdue" value={stats.late} />
          <Kpi icon="ban" tone="info" label="Blocked" value={stats.blocked} />
        </div>
      )}

      <div className="card">
        <div className="row filters mb">
          <div className="tabs" style={{ margin: 0, border: 0 }} role="group" aria-label="View">
            <button aria-pressed={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
            <button aria-pressed={view === "board"} className={view === "board" ? "active" : ""} onClick={() => setView("board")}>Board</button>
          </div>
          <select aria-label="Filter by person" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Everyone</option>
            {mine && <option value={profile!.id}>Me</option>}
            {!mine && <option value="__none">Unassigned</option>}
            {!mine && staff.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <select aria-label="Filter by client" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">All clients</option>
            {Object.entries(clientNames).sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <label className="row small" style={{ margin: 0 }}><input type="checkbox" style={{ width: "auto" }} checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)} /> Overdue only</label>
          {view === "list" && <label className="row small" style={{ margin: 0 }}><input type="checkbox" style={{ width: "auto" }} checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done</label>}
        </div>

        {view === "list" ? (
          <TaskTable tasks={filtered} names={names} clientNames={clientNames} onEdit={(t) => setModal(t)} onChanged={load} />
        ) : (
          <div className="board">
            {TASK_STATUSES.map((s) => {
              const col = filtered.filter((t) => t.status === s.key);
              return (
                <div className={`col ${overCol === s.key ? "drag-over" : ""}`} key={s.key}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverCol(s.key); }}
                  onDragLeave={() => setOverCol((c) => (c === s.key ? null : c))}
                  onDrop={(e) => onDrop(e, s.key)}>
                  <div className="col-head"><span className={`col-dot ${s.key}`} aria-hidden /><span>{s.label}</span><span className="muted count">{col.length}</span></div>
                  {col.slice(0, 60).map((t) => (
                    <div className="tcard" key={t.id} draggable onDragStart={(e) => onDragStart(e, t)}>
                      <div className="t"><button type="button" className="linklike" onClick={() => setModal(t)}>{t.title}</button></div>
                      <div className="meta">
                        {t.client_id && <Link to={`/clients/${t.client_id}`}>{clientNames[t.client_id]}</Link>}
                        <PriorityBadge p={t.priority} />
                        {t.due_date && <span className={isOverdue(t.due_date, t.status === "done") ? "badge bad" : ""}>{fmtDate(t.due_date)}</span>}
                        {!mine && t.assignee_id && <span>{names[t.assignee_id]}</span>}
                      </div>
                      <select aria-label={`Status of ${t.title}`} className="mt" value={t.status} onChange={(e) => move(t, e.target.value as TaskStatus)} style={{ marginTop: 8, fontSize: 12, padding: "4px 8px" }}>
                        {TASK_STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                    </div>
                  ))}
                  {col.length > 60 && <div className="small muted">+{col.length - 60} more — use filters</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && <TaskForm task={modal === "new" ? undefined : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}
