import { useEffect, useState, type FormEvent } from "react";
import { supabase, fetchSiteInfo, type SiteInfo, type StageSetting } from "../lib/supabase";
import { Field, Loading } from "../components/ui";
import { Link } from "react-router-dom";

export default function Settings() {
  const [rows, setRows] = useState<StageSetting[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.from("stage_settings").select("*").order("position").then(({ data }) => setRows((data as StageSetting[]) ?? []));
  }, []);

  async function save() {
    setMsg(null);
    for (const r of rows ?? []) {
      const { error } = await supabase.from("stage_settings").update({ sla_days: r.sla_days, task_title: r.task_title }).eq("stage", r.stage);
      if (error) { setMsg({ ok: false, text: error.message }); return; }
    }
    setMsg({ ok: true, text: "Saved. New deadlines apply the next time a client enters each stage." });
  }

  if (!rows) return <Loading />;
  return (
    <>
      <div className="page-head">
        <div><h1>Settings</h1><p>How long each pipeline stage should take, and the task created automatically when a client enters it.</p></div>
        <button className="btn primary" onClick={save}>Save changes</button>
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
      <div className="card">
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Stage</th><th style={{ width: 130 }}>Days allowed</th><th>Auto-created task</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.stage}>
                <td className="muted">{r.position}</td>
                <td><b>{r.label}</b></td>
                <td><input aria-label={`Days allowed for ${r.label}`} type="number" min={0} value={r.sla_days}
                  onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, sla_days: +e.target.value } : x))} /></td>
                <td><input aria-label={`Auto-created task for ${r.label}`} value={r.task_title ?? ""} placeholder="No task"
                  onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, task_title: e.target.value || null } : x))} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      <BusinessDetails />
    </>
  );
}

const INFO_FIELDS: [keyof SiteInfo, string][] = [
  ["business_name", "Brand name"], ["legal_name", "Registered business name"], ["address", "Registered address"],
  ["contact_email", "Contact email"], ["contact_phone", "Contact phone"],
  ["grievance_officer", "Grievance officer (DPDP Act)"], ["grievance_email", "Grievance officer email"],
];

/** Business details shown on the public Privacy, Terms and Cookie pages. */
function BusinessDetails() {
  const [info, setInfo] = useState<SiteInfo | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchSiteInfo().then(setInfo); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!info) return;
    setBusy(true); setMsg(null);
    const patch = Object.fromEntries(INFO_FIELDS.map(([k]) => [k, String(info[k] ?? "").trim()]));
    const { error } = await supabase.from("site_info").update(patch).eq("id", 1);
    setBusy(false);
    setMsg(error
      ? { ok: false, text: /site_info/.test(error.message) ? "Business details need the latest database update (migration 0006) first." : error.message }
      : { ok: true, text: "Business details saved. They now show on the Privacy, Terms and Cookie pages." });
  }

  if (!info) return null;
  const missing = INFO_FIELDS.filter(([k]) => String(info[k] ?? "").includes("[FILL IN")).length;
  return (
    <div className="card mt">
      <div className="card-head"><h2>Business & legal details</h2>{missing > 0 && <span className="badge warn">{missing} to fill in</span>}</div>
      <p className="muted small">Shown on the public <Link to="/privacy">Privacy Policy</Link>, <Link to="/terms">Terms</Link> and <Link to="/cookies">Cookie Policy</Link>. India's DPDP Act requires a named contact for privacy complaints (grievance officer).</p>
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`} role="status">{msg.text}</div>}
      <form onSubmit={save} className="form-grid">
        {INFO_FIELDS.map(([k, label]) => (
          <Field key={k} label={label} full={k === "address"}>
            <input required value={String(info[k] ?? "")} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} />
          </Field>
        ))}
        <div className="full"><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save business details"}</button></div>
      </form>
    </div>
  );
}
