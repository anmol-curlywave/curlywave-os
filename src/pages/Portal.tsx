import { useEffect, useState } from "react";
import { supabase, type Stage } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Empty, ExtLink, Loading, Progress, StageBadge, Stepper } from "../components/ui";
import { fmtDate } from "../lib/format";

interface Project {
  id: string; client_code: string; company_name: string; stage: Stage; stage_label: string; progress_pct: number;
  plan_name: string | null; plan_start: string | null; plan_end: string | null;
  drive_folder_url: string | null; content_plan_url: string | null; account_manager: string | null;
}

const WHAT_NEXT: Record<Stage, string> = {
  intake: "We're collecting your business details and brand assets.",
  research: "Our team is researching your business, competitors and audience.",
  content_plan: "We're writing your content plan.",
  client_review: "Your content plan is ready for your review.",
  revisions: "We're working on the changes you asked for.",
  generation: "Your images and videos are being created.",
  delivery: "We're uploading your creatives to your Drive folder.",
  final_approval: "Your creatives are ready — please review and approve them.",
  posting: "Your posts are scheduled and going live.",
  completed: "This plan is complete. Thank you!",
};

export default function Portal() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    supabase.rpc("my_projects").then(({ data }) => setProjects((data as Project[]) ?? []));
  }, []);

  if (!projects) return <Loading />;
  return (
    <>
      <div className="page-head">
        <div><h1>Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1><p>Track your project with Curlywave.</p></div>
      </div>
      {projects.length === 0 && <div className="card"><Empty>Your project isn't linked yet. Your account manager will set it up shortly.</Empty></div>}
      {projects.map((p) => (
        <div className="card" key={p.id}>
          <div className="card-head">
            <div><h2>{p.company_name}</h2><div className="small muted">Client #{p.client_code}{p.plan_name ? ` · ${p.plan_name}` : ""}</div></div>
            <StageBadge stage={p.stage} label={p.stage_label} />
          </div>
          <Stepper stage={p.stage} />
          <div className="row mt">
            <div style={{ width: 220 }}><Progress pct={p.progress_pct} tone={p.stage === "completed" ? "ok" : undefined} /></div>
            <b>{p.progress_pct}% complete</b>
          </div>
          <div className="alert info mt">{WHAT_NEXT[p.stage]}</div>
          <dl className="kv">
            <dt>Account manager</dt><dd>{p.account_manager ?? "—"}</dd>
            <dt>Plan period</dt><dd>{p.plan_start || p.plan_end ? `${fmtDate(p.plan_start)} – ${fmtDate(p.plan_end)}` : "Not set yet"}</dd>
            <dt>Content plan</dt><dd>{p.content_plan_url ? <ExtLink href={p.content_plan_url}>Open content plan</ExtLink> : "Not shared yet"}</dd>
            <dt>Creatives folder</dt><dd>{p.drive_folder_url ? <ExtLink href={p.drive_folder_url}>Open Google Drive folder</ExtLink> : "Not shared yet"}</dd>
          </dl>
        </div>
      ))}
    </>
  );
}
