import { TASK_STATUSES, supabase, type Task, type TaskStatus } from "../lib/supabase";
import { fmtDate, isOverdue } from "../lib/format";
import { Empty, PriorityBadge } from "./ui";

export default function TaskTable({ tasks, names, clientNames, onEdit, onChanged, hideClient }: {
  tasks: Task[];
  names: Record<string, string>;
  clientNames?: Record<string, string>;
  onEdit: (t: Task) => void;
  onChanged: () => void;
  hideClient?: boolean;
}) {
  if (tasks.length === 0) return <Empty>No tasks here.</Empty>;

  async function setStatus(t: Task, status: TaskStatus) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
    if (error) alert(error.message); else onChanged();
  }

  return (
    <div className="table-wrap"><table>
      <thead><tr><th>Task</th>{!hideClient && <th>Client</th>}<th>Assigned to</th><th>Due</th><th>Status</th><th /></tr></thead>
      <tbody>
        {tasks.map((t) => {
          const late = isOverdue(t.due_date, t.status === "done");
          return (
            <tr key={t.id}>
              <td style={{ maxWidth: 360 }}>
                <b style={{ textDecoration: t.status === "done" ? "line-through" : undefined }}>{t.title}</b>{" "}
                <PriorityBadge p={t.priority} />
                {t.auto_generated && <span className="badge" title="Created automatically by the pipeline" style={{ marginLeft: 4 }}>auto</span>}
                {t.description && <div className="small muted">{t.description}</div>}
              </td>
              {!hideClient && <td>{t.client_id ? clientNames?.[t.client_id] ?? "—" : <span className="muted">Internal</span>}</td>}
              <td>{t.assignee_id ? names[t.assignee_id] ?? "—" : <span className="muted">Unassigned</span>}</td>
              <td>{late ? <span className="badge bad">{fmtDate(t.due_date)}</span> : fmtDate(t.due_date)}</td>
              <td>
                <select value={t.status} onChange={(e) => setStatus(t, e.target.value as TaskStatus)} style={{ width: 130 }}>
                  {TASK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </td>
              <td><button className="btn sm" onClick={() => onEdit(t)}>Edit</button></td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );
}
