// Offline UI test suite: every role × desktop/tablet/mobile, key flows, console errors, layout overflow.
// Run: npm run build && npx vite preview --port 4173 & node tests/ui.test.mjs
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import { makeStore, installMock } from "./mock-backend.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:4173";
const ROOT = new URL(BASE + "/").pathname.replace(/\/+$/, "/"); // "/" or "/curlywave-os/"
const SHOTS = "/tmp/shots";
mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = { desktop: { width: 1366, height: 820 }, tablet: { width: 820, height: 1100 }, mobile: { width: 390, height: 844 } };

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name) { if (cond) pass++; else { fail++; failures.push(name); console.log("  ✗", name); } }

async function newPage(browser, vp, role, schemeDark = false) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], colorScheme: schemeDark ? "dark" : "light", serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  page.on("dialog", (d) => d.accept());
  const store = makeStore();
  const mock = await installMock(page, store, { loggedInAs: role });
  return { ctx, page, errors, store, mock };
}

async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function visit(page, path, expectText, tag) {
  await page.goto(BASE + path);
  try { await page.getByText(expectText, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 8000 }); ok(true, tag); }
  catch { ok(false, `${tag}: missing "${expectText}"`); }
}

const ROUTES = {
  "u-admin": [["/", "Delayed clients"], ["/clients", "Tiwari Motors"], ["/clients/c1", "Pipeline"], ["/tasks", "Every task"], ["/employees", "Ravi Employee"], ["/employees/u-emp", "Clients handled"], ["/settings", "Days allowed"], ["/account", "Change password"]],
  "u-emp": [["/", "My tasks"], ["/clients", "My clients"], ["/clients/c1", "Pipeline"], ["/account", "Change password"]],
  "u-client": [["/", "Cart's by Kapoor"], ["/account", "Change password"]],
  "u-pending": [["/", "Waiting for access"]],
};

const browser = await chromium.launch();

for (const vp of Object.keys(VIEWPORTS)) {
  for (const role of Object.keys(ROUTES)) {
    for (const dark of [false, true]) {
      if (dark && vp === "tablet") continue;
      const { ctx, page, errors } = await newPage(browser, vp, role, dark);
      for (const [path, text] of ROUTES[role]) {
        const tag = `${role} ${vp}${dark ? " dark" : ""} ${path}`;
        await visit(page, path, text, tag);
        ok(await noOverflow(page), `${tag}: no horizontal overflow`);
        if (!dark) await page.screenshot({ path: `${SHOTS}/${role}-${vp}${path.replace(/\//g, "_") || "_root"}.png`, fullPage: false });
      }
      ok(errors.length === 0, `${role} ${vp}${dark ? " dark" : ""}: no console errors ${errors.join(" | ")}`);
      await ctx.close();
    }
  }
}

// ---------- Access control: employee/client must not reach admin pages ----------
{
  const { ctx, page } = await newPage(browser, "desktop", "u-emp");
  await page.goto(BASE + "/employees");
  await page.waitForTimeout(800);
  ok(new URL(page.url()).pathname.replace(/\/?$/, "/") === ROOT, "employee redirected away from /employees");
  await page.goto(BASE + "/settings"); await page.waitForTimeout(500);
  ok(new URL(page.url()).pathname.replace(/\/?$/, "/") === ROOT, "employee redirected away from /settings");
  await page.goto(BASE + "/clients");
  await page.getByText("Tiwari Motors").first().waitFor();
  ok(!(await page.getByText("Done Co").count()), "employee does not see other employees' clients");
  ok(!(await page.getByRole("button", { name: "+ New client" }).count()), "employee has no New client button");
  await ctx.close();
}
{
  const { ctx, page } = await newPage(browser, "desktop", "u-client");
  await page.goto(BASE + "/clients"); await page.waitForTimeout(600);
  ok(new URL(page.url()).pathname.replace(/\/?$/, "/") === ROOT, "client redirected away from /clients");
  await page.goto(BASE + "/"); await page.getByText("Cart's by Kapoor").first().waitFor();
  ok(await page.getByText("Your content plan is ready for your review").count() > 0, "client sees next-step message");
  ok(!(await page.getByText("VIP client").count()), "client never sees internal notes");
  await ctx.close();
}

// ---------- Login flow ----------
{
  const { ctx, page, errors, mock } = await newPage(browser, "desktop", null);
  await page.goto(BASE + "/");
  await page.getByLabel("Email").fill("admin@test.in");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Wrong email or password.").waitFor({ timeout: 5000 }).then(() => ok(true, "wrong password message"), () => ok(false, "wrong password message"));
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Delayed clients").waitFor({ timeout: 8000 }).then(() => ok(true, "admin login lands on dashboard"), () => ok(false, "admin login lands on dashboard"));
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("heading", { name: "Sign in" }).waitFor({ timeout: 5000 }).then(() => ok(true, "sign out returns to login"), () => ok(false, "sign out returns to login"));
  ok(mock.me === null, "logout call made");
  await page.getByText("Create account").click();
  ok(await page.getByLabel("Full name").count() === 1, "create account form shows name");
  await page.getByText("Back to sign in").click();
  await page.getByText("Forgot password?").click();
  await page.getByLabel("Email").fill("admin@test.in");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByText("reset link is on its way").waitFor({ timeout: 5000 }).then(() => ok(true, "reset link message"), () => ok(false, "reset link message"));
  ok(errors.length === 0, "login flow no console errors " + errors.join(" | "));
  await ctx.close();
}
{
  // Expired email link
  const { ctx, page } = await newPage(browser, "desktop", null);
  await page.goto(BASE + "/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await page.getByText("Email link is invalid or has expired").waitFor({ timeout: 5000 }).then(() => ok(true, "expired link shown"), () => ok(false, "expired link shown"));
  await ctx.close();
}

// ---------- Admin flows ----------
{
  const { ctx, page, errors, store } = await newPage(browser, "desktop", "u-admin");
  // sorting: 9 before 37 before 100 before 150 before 290
  await page.goto(BASE + "/clients");
  await page.getByText("Tiwari Motors").first().waitFor();
  const codes = await page.locator("tbody tr td:first-child").allInnerTexts();
  ok(JSON.stringify(codes) === JSON.stringify(["#9", "#37", "#100", "#150", "#290"]), "clients sorted numerically: " + codes.join(","));
  // filters
  await page.locator("select").filter({ hasText: "Any status" }).selectOption("delayed");
  ok(await page.locator("tbody tr").count() === 1, "delayed filter shows 1");
  await page.locator("select").filter({ hasText: "Any status" }).selectOption("");
  await page.getByPlaceholder("Search name, code, city…").fill("kapoor");
  ok(await page.locator("tbody tr").count() === 1, "search works");
  await page.getByPlaceholder("Search name, code, city…").fill("");
  // new client — duplicate code error
  await page.getByRole("button", { name: "+ New client" }).click();
  await page.getByPlaceholder("e.g. 294").fill("37");
  await page.locator('form#client-form input[required]').nth(1).fill("Dup");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("That client code is already used.").waitFor({ timeout: 5000 }).then(() => ok(true, "duplicate client code error"), () => ok(false, "duplicate client code error"));
  await page.getByPlaceholder("e.g. 294").fill("#401");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(800);
  const created = store.clients.find((c) => c.company_name === "Dup");
  ok(created && created.client_code === "401", "new client saved with # stripped");
  ok(created && !("employee_name" in created && created.employee_name === undefined), "payload clean");
  // client detail: move stage, add rule, add task, tabs
  await page.goto(BASE + "/clients/c1");
  await page.getByRole("button", { name: /Move to Client review/ }).click();
  await page.waitForTimeout(600);
  ok(store.clients.find((c) => c.id === "c1").stage === "client_review", "stage moved");
  await page.getByRole("button", { name: /^Rules/ }).click();
  await page.getByPlaceholder(/Never say/).fill("No festival posts");
  await page.getByRole("button", { name: "Add rule" }).click();
  await page.waitForTimeout(500);
  ok(store.client_rules.some((r) => r.rule === "No festival posts"), "rule added");
  await page.getByRole("button", { name: /^Tasks/ }).click();
  await page.getByRole("button", { name: "+ Add task" }).click();
  await page.locator("form#task-form input[required]").fill("Call client about logo");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(600);
  ok(store.tasks.some((t) => t.title === "Call client about logo" && t.client_id === "c1"), "task added to client");
  await page.getByRole("button", { name: "Activity" }).click();
  ok(await page.getByText("moved the stage from").count() > 0, "activity renders");
  await page.getByRole("button", { name: "Client login" }).click();
  await page.getByRole("button", { name: "Create client login" }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByText("Login created").waitFor({ timeout: 5000 }).then(() => ok(true, "client login created"), () => ok(false, "client login created"));
  // tasks page: board + status change
  await page.goto(BASE + "/tasks");
  await page.getByRole("button", { name: "Board" }).click();
  ok(await page.locator(".col").count() === 5, "board has 5 columns");
  await page.getByRole("button", { name: "List" }).click();
  const firstSelect = page.locator("tbody tr").first().locator("select");
  await firstSelect.selectOption("done");
  await page.waitForTimeout(500);
  ok(store.tasks.filter((t) => t.status === "done").length >= 3, "task status change saved");
  const assigneeOpts = await page.locator("select").nth(0).locator("option").allInnerTexts();
  ok(!assigneeOpts.includes("Kapoor Client") && !assigneeOpts.includes("New Person"), "assignee filter lists only staff");
  // team: add member, approve pending
  await page.goto(BASE + "/employees");
  await page.getByText("Waiting for approval").waitFor();
  await page.getByRole("button", { name: "Approve as employee" }).click();
  await page.getByText("is now employee").waitFor({ timeout: 5000 }).then(() => ok(true, "approve pending"), () => ok(false, "approve pending"));
  await page.getByRole("button", { name: "+ Add team member" }).click();
  await page.locator("form#member-form input").nth(0).fill("Test Person");
  await page.locator("form#member-form input").nth(1).fill("tp@test.in");
  await page.getByRole("button", { name: "Create login" }).click();
  await page.getByText("Login created for Test Person").waitFor({ timeout: 5000 }).then(() => ok(true, "add member"), () => ok(false, "add member"));
  // settings save
  await page.goto(BASE + "/settings");
  await page.locator("tbody input[type=number]").first().fill("4");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Saved.").waitFor({ timeout: 5000 }).then(() => ok(true, "settings saved"), () => ok(false, "settings saved"));
  ok(store.stage_settings[0].sla_days === 4, "SLA persisted");
  // account: mismatched passwords
  await page.goto(BASE + "/account");
  await page.getByLabel("New password", { exact: true }).fill("abcdefgh");
  await page.getByLabel("Repeat new password").fill("abcdefgX");
  await page.getByRole("button", { name: "Change password" }).click();
  ok(await page.getByText("don't match").count() === 1, "password mismatch caught");
  ok(errors.length === 0, "admin flows no console errors " + errors.join(" | "));
  await ctx.close();
}

// ---------- Employee flows ----------
{
  const { ctx, page, errors, store } = await newPage(browser, "mobile", "u-emp");
  await page.goto(BASE + "/");
  await page.getByRole("heading", { name: "My tasks" }).waitFor();
  // mobile menu opens & closes
  await page.getByRole("button", { name: "Menu" }).click();
  ok(await page.locator(".sidebar.open").count() === 1, "mobile menu opens");
  await page.locator(".backdrop").click({ position: { x: 370, y: 400 } });
  ok(await page.locator(".sidebar.open").count() === 0, "mobile menu closes on backdrop");
  await page.getByRole("button", { name: "+ New task" }).click();
  await page.locator("form#task-form input[required]").fill("My own task");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(600);
  const t = store.tasks.find((x) => x.title === "My own task");
  ok(t && t.assignee_id === "u-emp" && t.created_by === "u-emp", "employee task self-assigned");
  await page.goto(BASE + "/clients/c1");
  await page.getByRole("button", { name: "Edit details" }).click();
  ok(await page.getByPlaceholder("e.g. 294").isDisabled(), "employee cannot edit client code");
  ok(await page.getByText("Assigned employee").count() === 0, "employee cannot reassign");
  ok(errors.length === 0, "employee flows no console errors " + errors.join(" | "));
  await ctx.close();
}

// ---------- PWA checks (real build served by vite preview) ----------
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/");
  const manifest = await (await page.request.get(BASE + "/manifest.webmanifest")).json();
  ok(manifest.name === "Curlywave OS" && manifest.icons.length >= 3 && manifest.display === "standalone", "manifest valid");
  for (const ic of manifest.icons) ok((await page.request.get(new URL(ic.src, BASE + "/manifest.webmanifest").href)).ok(), "icon reachable " + ic.src);
  const sw = await (await page.request.get(BASE + "/sw.js")).text();
  ok(!sw.includes("__BUILD_VERSION__"), "service worker version stamped");
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  ok(reg, "service worker activates");
  await ctx.setOffline(true);
  await page.goto(BASE + "/clients").catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1000);
  ok((await page.content()).includes("Curlywave"), "app shell loads offline");
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILURES:\n- " + failures.join("\n- ")); process.exit(1); }
