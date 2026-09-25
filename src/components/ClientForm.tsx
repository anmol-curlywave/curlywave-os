import { useEffect, useState, type FormEvent } from "react";
import { supabase, type Client, type Profile } from "../lib/supabase";
import { Field, Modal } from "./ui";
import { safeUrl } from "../lib/format";

type Draft = Partial<Client>;

const TEXT_FIELDS: [keyof Client, string, string?][] = [
  ["contact_name", "Contact person"], ["email", "Email", "email"], ["phone", "Phone"], ["whatsapp", "WhatsApp"],
  ["industry", "Industry / niche"], ["city", "City"], ["website", "Website", "url"],
  ["instagram", "Instagram"], ["facebook", "Facebook"], ["linkedin", "LinkedIn"], ["youtube", "YouTube"], ["x_handle", "X (Twitter)"],
];

export default function ClientForm({ client, isAdmin, onClose, onSaved }: {
  client?: Client; isAdmin: boolean; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [d, setD] = useState<Draft>(client ?? { language: "English", static_posts: 30, video_posts: 15, carousel_posts: 0 });
  const [staff, setStaff] = useState<Profile[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) supabase.from("profiles").select("*").in("role", ["admin", "employee"]).eq("is_active", true).order("full_name")
      .then(({ data }) => setStaff((data as Profile[]) ?? []));
  }, [isAdmin]);

  const set = (k: keyof Client, v: unknown) => setD((p) => ({ ...p, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const payload: Record<string, unknown> = { ...d };
    for (const k of ["id", "created_at", "updated_at", "stage_started_at", "stage_due_date", "created_by",
      "stage_label", "stage_position", "progress_pct", "employee_name", "open_tasks", "overdue_tasks", "is_delayed", "days_left"]) delete payload[k];
    for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
    if (!isAdmin) { delete payload.assigned_employee_id; delete payload.portal_user_id; delete payload.client_code; }
    payload.client_code = payload.client_code ? String(payload.client_code).replace(/^#/, "").trim() : payload.client_code;
    // Links must be real web addresses (adds https:// when missing; blocks javascript: and other schemes).
    for (const [k, label] of [["website", "Website"], ["drive_folder_url", "Google Drive folder URL"], ["content_plan_url", "Content plan URL"]] as const) {
      if (payload[k] == null) continue;
      const safe = safeUrl(String(payload[k]));
      if (!safe) { setBusy(false); setErr(`${label} must be a web link, e.g. https://example.com`); return; }
      payload[k] = safe;
    }

    const q = client
      ? supabase.from("clients").update(payload).eq("id", client.id).select("id").single()
      : supabase.from("clients").insert(payload).select("id").single();
    const { data, error } = await q;
    setBusy(false);
    if (error) { setErr(error.code === "23505" ? "That client code is already used." : error.message); return; }
    onSaved(data.id);
  }

  return (
    <Modal title={client ? `Edit #${client.client_code} ${client.company_name}` : "New client"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="client-form" disabled={busy}>{busy ? "Saving…" : "Save"}</button></>}>
      {err && <div className="alert">{err}</div>}
      <form id="client-form" onSubmit={save} className="form-grid">
        <Field label="Client code *">
          <input required disabled={!isAdmin} placeholder="e.g. 294" value={d.client_code ?? ""} onChange={(e) => set("client_code", e.target.value)} /></Field>
        <Field label="Company / brand name *">
          <input required value={d.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} /></Field>
        {TEXT_FIELDS.map(([k, label, type]) => (
          <Field key={k} label={label}>
            <input type={type === "url" ? "text" : type ?? "text"} inputMode={type === "url" ? "url" : undefined}
              autoComplete="off" value={(d[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>
        ))}
        <Field label="Content language">
          <input value={d.language ?? ""} onChange={(e) => set("language", e.target.value)} placeholder="English / Hindi / Hinglish…" /></Field>
        <Field label="Plan name">
          <input value={d.plan_name ?? ""} onChange={(e) => set("plan_name", e.target.value)} placeholder="e.g. 3-month 30S+15V" /></Field>
        <Field label="Static posts">
          <input type="number" min={0} value={d.static_posts ?? 0} onChange={(e) => set("static_posts", +e.target.value)} /></Field>
        <Field label="Video posts">
          <input type="number" min={0} value={d.video_posts ?? 0} onChange={(e) => set("video_posts", +e.target.value)} /></Field>
        <Field label="Carousel posts">
          <input type="number" min={0} value={d.carousel_posts ?? 0} onChange={(e) => set("carousel_posts", +e.target.value)} /></Field>
        <Field label="Plan start">
          <input type="date" value={d.plan_start ?? ""} onChange={(e) => set("plan_start", e.target.value)} /></Field>
        <Field label="Plan end / deadline">
          <input type="date" value={d.plan_end ?? ""} onChange={(e) => set("plan_end", e.target.value)} /></Field>
        {isAdmin && (
          <Field label="Assigned employee">
            <select value={d.assigned_employee_id ?? ""} onChange={(e) => set("assigned_employee_id", e.target.value)}>
              <option value="">— Unassigned —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
            </select></Field>
        )}
        <Field label="Google Drive folder URL">
          <input inputMode="url" placeholder="https://drive.google.com/…" value={d.drive_folder_url ?? ""} onChange={(e) => set("drive_folder_url", e.target.value)} /></Field>
        <Field label="Content plan URL" full>
          <input inputMode="url" placeholder="https://…" value={d.content_plan_url ?? ""} onChange={(e) => set("content_plan_url", e.target.value)} /></Field>
        <Field label="Internal notes" full>
          <textarea value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        <div className="field full">
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={!!d.is_on_hold} onChange={(e) => set("is_on_hold", e.target.checked)} />
            On hold (paused — not counted as delayed)
          </label>
        </div>
      </form>
    </Modal>
  );
}
