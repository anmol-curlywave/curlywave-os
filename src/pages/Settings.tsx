import { useEffect, useState } from "react";
import { supabase, type StageSetting } from "../lib/supabase";
import { Loading } from "../components/ui";

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
                <td><input type="number" min={0} value={r.sla_days}
                  onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, sla_days: +e.target.value } : x))} /></td>
                <td><input value={r.task_title ?? ""} placeholder="No task"
                  onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, task_title: e.target.value || null } : x))} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
