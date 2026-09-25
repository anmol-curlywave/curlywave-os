// In-memory fake of the Supabase endpoints the app uses, for offline UI tests.
const today = new Date();
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

export function makeStore() {
  const P = (id, email, full_name, role, extra = {}) => ({ id, email, full_name, role, phone: null, designation: null, is_active: true, created_at: "2026-09-01T10:00:00Z", ...extra });
  const profiles = [
    P("u-admin", "admin@test.in", "Asha Admin", "admin", { designation: "Founder" }),
    P("u-emp", "emp@test.in", "Ravi Employee", "employee", { designation: "Content writer" }),
    P("u-emp2", "emp2@test.in", "Neha Designer", "employee", { designation: "Designer" }),
    P("u-client", "client@test.in", "Kapoor Client", "client"),
    P("u-pending", "pending@test.in", "New Person", "pending"),
  ];
  const stages = ["intake","research","content_plan","client_review","revisions","generation","delivery","final_approval","posting","completed"];
  const labels = ["Intake","Research","Content plan","Client review","Revisions","Image/Video creation","Delivery","Final approval","Posting","Completed"];
  const stage_settings = stages.map((s, i) => ({ stage: s, label: labels[i], position: i + 1, sla_days: 2, task_title: s === "completed" ? null : `Do ${labels[i]}` }));
  const C = (id, code, name, stage, emp, extra = {}) => {
    const pos = stages.indexOf(stage) + 1;
    return { id, client_code: code, company_name: name, contact_name: "Owner " + code, email: `c${code}@x.in`, phone: "9876543210", whatsapp: null,
      industry: "Retail", city: "Delhi", website: "https://example.com", instagram: "@x", facebook: null, linkedin: null, youtube: null, x_handle: null,
      language: "English", plan_name: "3-month 30S+15V", static_posts: 30, video_posts: 15, carousel_posts: 0, plan_start: addDays(-20), plan_end: addDays(70),
      stage, stage_started_at: "2026-09-20T10:00:00Z", stage_due_date: addDays(2), is_on_hold: false, assigned_employee_id: emp, portal_user_id: null,
      drive_folder_url: "https://drive.google.com/x", content_plan_url: null, notes: "VIP client", created_by: "u-admin",
      created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-20T10:00:00Z",
      stage_label: labels[pos - 1], stage_position: pos, progress_pct: Math.round((pos - 1) * 100 / 9),
      employee_name: profiles.find((p) => p.id === emp)?.full_name ?? null, open_tasks: 2, overdue_tasks: 0, is_delayed: false, days_left: 2, ...extra };
  };
  const clients = [
    C("c1", "37", "Tiwari Motors Smart Garage", "content_plan", "u-emp"),
    C("c2", "290", "Cart's by Kapoor", "client_review", "u-emp", { portal_user_id: "u-client", is_delayed: true, days_left: -3, overdue_tasks: 1, stage_due_date: addDays(-3) }),
    C("c3", "9", "A Very Long Company Name Private Limited For Overflow Testing", "generation", "u-emp2"),
    C("c4", "100", "Done Co", "completed", null, { stage_due_date: null, days_left: null, progress_pct: 100 }),
    C("c5", "150", "Paused Brand", "research", "u-emp2", { is_on_hold: true }),
  ];
  const T = (id, client_id, title, status, assignee_id, due, extra = {}) => ({ id, client_id, title, description: null, stage: null, assignee_id, status,
    priority: "normal", due_date: due, completed_at: null, auto_generated: false, created_by: "u-admin", created_at: "2026-09-20T10:00:00Z", updated_at: "2026-09-20T10:00:00Z", ...extra });
  const tasks = [
    T("t1", "c1", "Build content plan & image prompts — Tiwari Motors", "in_progress", "u-emp", addDays(1), { auto_generated: true, stage: "content_plan" }),
    T("t2", "c2", "Follow up with client for plan approval — Cart's by Kapoor", "todo", "u-emp", addDays(-3), { auto_generated: true, priority: "urgent" }),
    T("t3", "c3", "Generate images & videos", "blocked", "u-emp2", addDays(4), { description: "Waiting for product photos" }),
    T("t4", null, "Internal: update agency deck", "done", "u-admin", addDays(-1)),
    T("t5", "c1", "Old intake task", "done", "u-emp", addDays(-10)),
  ];
  const client_rules = [{ id: "r1", client_id: "c1", rule: 'Brand is always "Tiwari Motors", never "Pradeep"', category: "brand", created_at: "2026-09-02T10:00:00Z" }];
  const activity_log = [
    { id: 1, client_id: "c1", task_id: null, actor_id: "u-admin", action: "client_created", details: { to: "intake" }, created_at: "2026-09-01T10:00:00Z" },
    { id: 2, client_id: "c1", task_id: null, actor_id: "u-emp", action: "stage_changed", details: { from: "research", to: "content_plan" }, created_at: "2026-09-20T10:00:00Z" },
  ];
  const employee_workload = profiles.filter((p) => p.role === "admin" || p.role === "employee").map((p) => ({
    id: p.id, full_name: p.full_name, email: p.email, designation: p.designation, role: p.role, is_active: p.is_active,
    active_clients: clients.filter((c) => c.assigned_employee_id === p.id && c.stage !== "completed").length,
    open_tasks: tasks.filter((t) => t.assignee_id === p.id && t.status !== "done").length, in_progress_tasks: 1, overdue_tasks: p.id === "u-emp" ? 1 : 0, done_last_7d: 2 }));
  return { profiles, stage_settings, clients, client_overview: clients, tasks, client_rules, activity_log, employee_workload };
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

/** Visibility rules mirroring the real database RLS. */
function visible(table, rows, me, store) {
  const p = store.profiles.find((x) => x.id === me);
  if (!p) return [];
  if (p.role === "admin") return rows;
  const myClients = new Set(store.clients.filter((c) => c.assigned_employee_id === me).map((c) => c.id));
  switch (table) {
    case "profiles": return p.role === "employee" ? rows.filter((r) => r.id === me || ["admin", "employee"].includes(r.role)) : rows.filter((r) => r.id === me);
    case "clients": case "client_overview": return p.role === "employee" ? rows.filter((r) => r.assigned_employee_id === me) : [];
    case "tasks": return p.role === "employee" ? rows.filter((r) => r.assignee_id === me || myClients.has(r.client_id)) : [];
    case "client_rules": case "activity_log": return p.role === "employee" ? rows.filter((r) => myClients.has(r.client_id)) : [];
    case "stage_settings": case "employee_workload": return p.role === "employee" ? rows : [];
    default: return [];
  }
}

function applyFilters(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(k)) continue;
    const [op, ...rest] = v.split("."); const val = rest.join(".");
    if (op === "eq") out = out.filter((r) => String(r[k]) === val);
    else if (op === "neq") out = out.filter((r) => String(r[k]) !== val);
    else if (op === "in") { const set = val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/"/g, "")); out = out.filter((r) => set.includes(String(r[k]))); }
    else if (op === "is") out = out.filter((r) => (val === "null" ? r[k] == null : String(r[k]) === val));
  }
  return out;
}

export async function installMock(page, store, opts = {}) {
  let me = opts.loggedInAs ?? null;
  const calls = [];
  const userObj = (id) => { const p = store.profiles.find((x) => x.id === id); return { id, aud: "authenticated", role: "authenticated", email: p.email, app_metadata: {}, user_metadata: {}, created_at: p.created_at }; };
  const session = (id) => ({ access_token: jwt(id), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-" + id, user: userObj(id) });

  if (me) {
    await page.addInitScript(([key, val]) => { localStorage.setItem(key, val); }, ["sb-dwwpxzewdmrnwpulkrwz-auth-token", JSON.stringify(session(me))]);
  }

  await page.route("https://dwwpxzewdmrnwpulkrwz.supabase.co/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    calls.push(`${req.method()} ${path}${url.search}`);
    if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });

    if (path === "/auth/v1/token") {
      const body = JSON.parse(req.postData() || "{}");
      if (url.searchParams.get("grant_type") === "password") {
        const p = store.profiles.find((x) => x.email === body.email);
        if (!p || body.password !== "Passw0rd!") return json({ error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials", code: "invalid_credentials" }, 400);
        me = p.id; return json(session(me));
      }
      return json(session(me));
    }
    if (path === "/auth/v1/user") {
      if (req.method() === "PUT") return json(userObj(me));
      return me ? json(userObj(me)) : json({ msg: "no user" }, 401);
    }
    if (path === "/auth/v1/logout") { me = null; return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } }); }
    if (path === "/auth/v1/signup") return json({ id: "new", email: "x", user: null, session: null });
    if (path === "/auth/v1/recover") return json({});
    if (path.startsWith("/functions/v1/admin-users")) return json({ ok: true, user_id: "u-new" });
    if (path === "/rest/v1/rpc/my_projects") {
      const p = store.profiles.find((x) => x.id === me);
      const rows = p?.role === "client" ? store.clients.filter((c) => c.portal_user_id === me).map((c) => ({ ...c, account_manager: c.employee_name })) : [];
      return json(rows);
    }

    const table = path.replace("/rest/v1/", "");
    const rows = store[table];
    if (!rows) return json({ message: "unknown table " + table }, 404);
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const vis = visible(table, rows, me, store);

    if (req.method() === "GET" || req.method() === "HEAD") {
      const out = applyFilters(vis, url.searchParams);
      if (single) return out.length ? json(out[0]) : json({ code: "PGRST116", message: "0 rows" }, 406);
      return json(out);
    }
    if (req.method() === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      const items = (Array.isArray(body) ? body : [body]).map((b) => ({ id: "new-" + Math.random().toString(36).slice(2, 8), created_at: new Date().toISOString(), ...b }));
      if (table === "clients" && items.some((i) => store.clients.some((c) => c.client_code === i.client_code))) return json({ code: "23505", message: "duplicate key" }, 409);
      rows.push(...items);
      return json(single ? items[0] : items, 201);
    }
    if (req.method() === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      const hits = applyFilters(vis, url.searchParams);
      hits.forEach((h) => Object.assign(h, body));
      if (table === "clients") hits.forEach((h) => { const ov = store.clients.find((c) => c.id === h.id); if (ov && body.stage) { const i = ["intake","research","content_plan","client_review","revisions","generation","delivery","final_approval","posting","completed"].indexOf(body.stage); ov.stage_position = i + 1; ov.progress_pct = Math.round(i * 100 / 9); ov.stage_label = store.stage_settings[i].label; } });
      return json(single ? hits[0] ?? null : hits);
    }
    if (req.method() === "DELETE") {
      const hits = new Set(applyFilters(vis, url.searchParams));
      store[table] = rows.filter((r) => !hits.has(r));
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    }
    return json({ message: "unsupported" }, 400);
  });
  return { calls, get me() { return me; } };
}
