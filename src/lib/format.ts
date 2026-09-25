export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d.length === 10 ? d + "T00:00:00" : d);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function isOverdue(due: string | null, done: boolean) {
  return !!due && !done && due < todayISO();
}

export function daysLeftText(days: number | null) {
  if (days === null) return "—";
  if (days < 0) return `${-days}d late`;
  if (days === 0) return "Due today";
  return `${days}d left`;
}

/** Generate a readable random password for new logins. */
export function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("") + "!9";
}

/** Sort client codes naturally: 9 < 37 < 100 < 290. */
export function byCode<T extends { client_code: string }>(a: T, b: T) {
  return a.client_code.localeCompare(b.client_code, undefined, { numeric: true, sensitivity: "base" });
}

const STATUS_ORDER = { blocked: 0, in_progress: 1, todo: 2, review: 3, done: 4 } as const;
/** Open work first (blocked, in progress, to do, review), then done; earliest due date first. */
export function byTaskPriority<T extends { status: keyof typeof STATUS_ORDER; due_date: string | null }>(a: T, b: T) {
  const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (s) return s;
  return (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : (a.due_date ?? "9999") > (b.due_date ?? "9999") ? 1 : 0;
}
