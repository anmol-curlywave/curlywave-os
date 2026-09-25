import { useEffect, useState, type FormEvent } from "react";
import { supabase, TASK_STATUSES, type Priority, type Profile, type Task, type TaskStatus } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Field, Modal } from "./ui";

export default function TaskForm({ task, clientId, onClose, onSaved }: {
  task?: Task; clientId?: string | null; onClose: () => void; onSaved: () => void;
}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignee, setAssignee] = useState(task?.assignee_id ?? profile?.id ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "normal");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [due, setDue] = useState(task?.due_date ?? "");
  const [client, setClient] = useState(task?.client_id ?? clientId ?? "");
  const [staff, setStaff] = useState<Profile[]>([]);
  const [clients, setClients] = useState<{ id: string; client_code: string; company_name: string; assigned_employee_id: string | null }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) supabase.from("profiles").select("*").in("role", ["admin", "employee"]).eq("is_active", true).order("full_name")
      .then(({ data }) => setStaff((data as Profile[]) ?? []));
    supabase.from("clients").select("id,client_code,company_name,assigned_employee_id").then(({ data }) => {
      const list = (data ?? []).sort((a, b) => a.client_code.localeCompare(b.client_code, undefined, { numeric: true }));
      setClients(list);
      // A new task on a client goes to that client's employee by default.
      if (!task && isAdmin && clientId) {
        const owner = list.find((c) => c.id === clientId)?.assigned_employee_id;
        if (owner) setAssignee(owner);
      }
    });
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const payload = {
      title: title.trim(), description: description.trim() || null, assignee_id: assignee || null,
      priority, status, due_date: due || null, client_id: client || null,
    };
    const { error } = task
      ? await supabase.from("tasks").update(payload).eq("id", task.id)
      : await supabase.from("tasks").insert({ ...payload, created_by: profile?.id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  async function remove() {
    if (!task || !confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) setErr(error.message); else onSaved();
  }

  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose}
      footer={<>
        {task && isAdmin && <button className="btn danger" onClick={remove} style={{ marginRight: "auto" }}>Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" form="task-form" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </>}>
      {err && <div className="alert">{err}</div>}
      <form id="task-form" onSubmit={save} className="form-grid">
        <Field label="Title *" full><input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Details" full><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Client">
          <select value={client} onChange={(e) => { setClient(e.target.value); if (!task && isAdmin) { const owner = clients.find((c) => c.id === e.target.value)?.assigned_employee_id; if (owner) setAssignee(owner); } }}>
            <option value="">— Internal / no client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>#{c.client_code} {c.company_name}</option>)}
          </select></Field>
        <Field label="Assigned to">
          {isAdmin ? (
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— Unassigned —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
            </select>
          ) : <input disabled value={task && task.assignee_id !== profile?.id ? "Someone else" : "Me"} />}
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {TASK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select></Field>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select></Field>
        <Field label="Due date"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
