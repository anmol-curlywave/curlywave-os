// Weekly "opened vs completed" area chart, adapted from 21st.dev "App Dashboard Layout"
// (shadcnstore/app-1) to plain SVG — no chart library. The two series separate by form
// (dashed line vs filled area), not colour alone, so they stay readable in both themes.
import { useMemo } from "react";
import type { Task } from "../lib/supabase";

const WEEKS = 8;

function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

/** Smooth path through points (Catmull-Rom → cubic bezier). */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function ThroughputChart({ tasks }: { tasks: Task[] }) {
  const { weeks, maxV } = useMemo(() => {
    const start = weekStart(new Date());
    start.setDate(start.getDate() - 7 * (WEEKS - 1));
    const buckets = Array.from({ length: WEEKS }, (_, i) => {
      const from = new Date(start); from.setDate(from.getDate() + i * 7);
      const to = new Date(from); to.setDate(to.getDate() + 7);
      return { from, to, opened: 0, completed: 0 };
    });
    for (const t of tasks) {
      const c = new Date(t.created_at);
      const done = t.completed_at ? new Date(t.completed_at) : null;
      for (const b of buckets) {
        if (c >= b.from && c < b.to) b.opened++;
        if (done && done >= b.from && done < b.to) b.completed++;
      }
    }
    return { weeks: buckets, maxV: Math.max(2, ...buckets.map((b) => Math.max(b.opened, b.completed))) };
  }, [tasks]);

  const W = 640, H = 190, PAD = { l: 30, r: 10, t: 14, b: 26 };
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (WEEKS - 1);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / maxV);
  const pOpen: [number, number][] = weeks.map((b, i) => [x(i), y(b.opened)]);
  const pDone: [number, number][] = weeks.map((b, i) => [x(i), y(b.completed)]);
  const lbl = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const gridV = [0, Math.round(maxV / 2), maxV];
  const totalDone = weeks.reduce((s, b) => s + b.completed, 0);
  const totalOpen = weeks.reduce((s, b) => s + b.opened, 0);

  return (
    <figure className="chart" role="img"
      aria-label={`Task throughput over the last ${WEEKS} weeks: ${totalOpen} tasks opened, ${totalDone} completed.`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        <defs>
          <linearGradient id="tp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridV.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.l - 8} y={y(v) + 4} className="chart-tick" textAnchor="end">{v}</text>
          </g>
        ))}
        {weeks.map((b, i) => (
          <text key={i} x={x(i)} y={H - 8} className="chart-tick" textAnchor="middle">{lbl(b.from)}</text>
        ))}
        <path d={`${smooth(pDone)} L ${x(WEEKS - 1)},${y(0)} L ${x(0)},${y(0)} Z`} fill="url(#tp-fill)" stroke="none" />
        <path d={smooth(pDone)} className="chart-line done" />
        <path d={smooth(pOpen)} className="chart-line open" />
        {weeks.map((b, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(b.completed)} r="9" className="chart-hit">
              <title>{`Week of ${lbl(b.from)}: ${b.opened} opened, ${b.completed} completed`}</title>
            </circle>
            <circle cx={x(i)} cy={y(b.completed)} r="3" className="chart-dot" />
          </g>
        ))}
      </svg>
      <figcaption className="chart-legend small">
        <span><span className="swatch done" aria-hidden />Completed</span>
        <span><span className="swatch open" aria-hidden />Opened</span>
      </figcaption>
    </figure>
  );
}
