import { _electron as electron } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
import { makeStore, installMock } from "../../tests/mock-backend.mjs";
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log("  ✓", n); } else { fail++; console.log("  ✗", n); } };

// 1) Normal launch against the web app
{
  const app = await electron.launch({ executablePath: process.cwd() + "/node_modules/electron/dist/electron", args: [".", "--no-sandbox"], cwd: process.cwd(), env: { ...process.env, CURLYWAVE_APP_URL: "http://localhost:4173" } });
  const ctx = app.context();
  // mock backend for the Supabase calls
  const store = makeStore();
  await ctx.route("https://dwwpxzewdmrnwpulkrwz.supabase.co/**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.getByRole("heading", { name: "Sign in" }).waitFor({ timeout: 15000 }).then(() => ok(true, "desktop window shows the app login"), () => ok(false, "desktop window shows the app login"));
  ok((await win.title()) === "Curlywave OS", "window title");
  const ua = await win.evaluate(() => navigator.userAgent);
  ok(/CurlywaveDesktop\/1\.0\.0/.test(ua), "desktop user agent marker");
  const nodeLeak = await win.evaluate(() => typeof require === "undefined" && typeof process === "undefined");
  ok(nodeLeak, "no Node.js access from the web page (secure)");
  const before = app.windows().length;
  await win.evaluate(() => window.open("https://example.com", "_blank"));
  await win.waitForTimeout(800);
  ok(app.windows().length === before, "external links don't open inside the app");
  const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((i) => i.label));
  ok(menu.includes("Edit") && menu.includes("View"), "menu has Edit (copy/paste) and View: " + menu.join(","));
  const size = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getMinimumSize());
  ok(size[0] === 380, "minimum window size set");
  await app.close();
}
// 2) Offline: app URL unreachable -> offline screen
{
  const app = await electron.launch({ executablePath: process.cwd() + "/node_modules/electron/dist/electron", args: [".", "--no-sandbox"], cwd: process.cwd(), env: { ...process.env, CURLYWAVE_APP_URL: "http://localhost:9" } });
  const win = await app.firstWindow();
  await win.getByText("You're offline").waitFor({ timeout: 15000 }).then(() => ok(true, "offline screen when no internet"), () => ok(false, "offline screen when no internet"));
  ok(win.url().includes("offline.html") && win.url().includes("url=http"), "offline screen knows where to reconnect");
  await app.close();
}
// 3) Window state is remembered
{
  const app = await electron.launch({ executablePath: process.cwd() + "/node_modules/electron/dist/electron", args: [".", "--no-sandbox"], cwd: process.cwd(), env: { ...process.env, CURLYWAVE_APP_URL: "http://localhost:4173" } });
  await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 50, y: 60, width: 1000, height: 700 }));
  await app.close();
  const app2 = await electron.launch({ executablePath: process.cwd() + "/node_modules/electron/dist/electron", args: [".", "--no-sandbox"], cwd: process.cwd(), env: { ...process.env, CURLYWAVE_APP_URL: "http://localhost:4173" } });
  await app2.firstWindow();
  const b = await app2.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  ok(b.width === 1000 && b.height === 700, "window size remembered " + JSON.stringify(b));
  await app2.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
