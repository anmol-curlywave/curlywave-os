import { useEffect, useRef, type ReactNode } from "react";
import { STAGES, type Stage, type TaskStatus, type Priority } from "../lib/supabase";

export function Modal({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Progress({ pct, tone }: { pct: number; tone?: "bad" | "ok" }) {
  return <div className={`progress ${tone ?? ""}`}><span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}

export function StageBadge({ stage, label }: { stage: Stage; label?: string }) {
  const tone = stage === "completed" ? "ok" : stage === "client_review" || stage === "final_approval" ? "warn" : "brand";
  return <span className={`badge ${tone}`}>{label ?? STAGES.find((s) => s.key === stage)?.label}</span>;
}

const statusTone: Record<TaskStatus, string> = { todo: "", in_progress: "info", review: "warn", blocked: "bad", done: "ok" };
const statusText: Record<TaskStatus, string> = { todo: "To do", in_progress: "In progress", review: "In review", blocked: "Blocked", done: "Done" };
export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge ${statusTone[status]}`}>{statusText[status]}</span>;
}

const prioTone: Record<Priority, string> = { low: "", normal: "", high: "warn", urgent: "bad" };
export function PriorityBadge({ p }: { p: Priority }) {
  if (p === "normal") return null;
  return <span className={`badge ${prioTone[p]}`}>{p[0].toUpperCase() + p.slice(1)}</span>;
}

export function HealthBadge({ delayed, onHold, completed }: { delayed: boolean; onHold: boolean; completed: boolean }) {
  if (completed) return <span className="badge ok">Completed</span>;
  if (onHold) return <span className="badge">On hold</span>;
  return delayed ? <span className="badge bad">Delayed</span> : <span className="badge ok">On time</span>;
}

export function Stepper({ stage }: { stage: Stage }) {
  const idx = STAGES.findIndex((s) => s.key === stage);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // On narrow screens keep the current stage visible.
    const el = ref.current?.querySelector<HTMLElement>(".step.current");
    const box = ref.current;
    if (el && box && box.scrollWidth > box.clientWidth) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
  }, [stage]);
  return (
    <div className="stepper" ref={ref}>
      {STAGES.map((s, i) => (
        <div key={s.key} className={`step ${i < idx || stage === "completed" ? "done" : i === idx ? "current" : ""}`}>
          <div className="bar" />
          {s.label}
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Loading() {
  return <div className="empty">Loading…</div>;
}
