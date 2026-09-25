import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type Role = "admin" | "employee" | "client" | "pending";
export type Stage =
  | "intake" | "research" | "content_plan" | "client_review" | "revisions"
  | "generation" | "delivery" | "final_approval" | "posting" | "completed";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface Profile {
  id: string; email: string; full_name: string; phone: string | null;
  designation: string | null; role: Role; is_active: boolean; created_at: string;
  /** Added in migration 0006 — undefined while that migration isn't applied yet. */
  consent_version?: string | null; consent_at?: string | null; deletion_requested_at?: string | null;
}

/** Bump this when the Privacy Policy or Terms change in a way users must agree to again. */
export const CONSENT_VERSION = "2026-09-25";

export interface SiteInfo {
  business_name: string; legal_name: string; address: string; contact_email: string; contact_phone: string;
  grievance_officer: string; grievance_email: string; updated_at?: string;
}
export const SITE_INFO_FALLBACK: SiteInfo = {
  business_name: "Curlywave", legal_name: "[FILL IN: registered business name]", address: "[FILL IN: registered address]",
  contact_email: "[FILL IN: contact email]", contact_phone: "[FILL IN: contact phone]",
  grievance_officer: "[FILL IN: grievance officer name]", grievance_email: "[FILL IN: grievance officer email]",
};
/** Public business details for the legal pages (readable without signing in). */
export async function fetchSiteInfo(): Promise<SiteInfo> {
  try {
    const { data, error } = await supabase.from("site_info").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return SITE_INFO_FALLBACK;
    return data as SiteInfo;
  } catch { return SITE_INFO_FALLBACK; }
}

export interface Client {
  id: string; client_code: string; company_name: string;
  contact_name: string | null; email: string | null; phone: string | null; whatsapp: string | null;
  industry: string | null; city: string | null; website: string | null;
  instagram: string | null; facebook: string | null; linkedin: string | null; youtube: string | null; x_handle: string | null;
  language: string; plan_name: string | null;
  static_posts: number; video_posts: number; carousel_posts: number;
  plan_start: string | null; plan_end: string | null;
  stage: Stage; stage_started_at: string; stage_due_date: string | null; is_on_hold: boolean;
  assigned_employee_id: string | null; portal_user_id: string | null;
  drive_folder_url: string | null; content_plan_url: string | null; notes: string | null;
  created_at: string; updated_at: string;
}

export interface ClientOverview extends Client {
  stage_label: string; stage_position: number; progress_pct: number; employee_name: string | null;
  open_tasks: number; overdue_tasks: number; is_delayed: boolean; days_left: number | null;
}

export interface Task {
  id: string; client_id: string | null; title: string; description: string | null;
  stage: Stage | null; assignee_id: string | null; status: TaskStatus; priority: Priority;
  due_date: string | null; completed_at: string | null; auto_generated: boolean;
  created_by: string | null; created_at: string; updated_at: string;
}

export interface Workload {
  id: string; full_name: string; email: string; designation: string | null; role: Role; is_active: boolean;
  active_clients: number; open_tasks: number; in_progress_tasks: number; overdue_tasks: number; done_last_7d: number;
}

export interface StageSetting { stage: Stage; label: string; position: number; sla_days: number; task_title: string | null; }

export const STAGES: { key: Stage; label: string }[] = [
  { key: "intake", label: "Intake" },
  { key: "research", label: "Research" },
  { key: "content_plan", label: "Content plan" },
  { key: "client_review", label: "Client review" },
  { key: "revisions", label: "Revisions" },
  { key: "generation", label: "Image/Video creation" },
  { key: "delivery", label: "Delivery" },
  { key: "final_approval", label: "Final approval" },
  { key: "posting", label: "Posting" },
  { key: "completed", label: "Completed" },
];
export const stageLabel = (s: Stage | null | undefined) => STAGES.find((x) => x.key === s)?.label ?? "—";

export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "In review" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

/** Call the admin-users edge function (admin only). */
export async function adminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) msg = (await ctx.json()).error ?? msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
