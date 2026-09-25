# Curlywave OS — Project Context (hand-off for a new chat)

> **Starting a new chat?** Upload this file (or the whole zip) and say:
> *"Continue building Curlywave OS from PROJECT_CONTEXT.md. Code is in my Curlywave-OS folder on the Desktop."*
> Last updated: 25 Sep 2026 (moved hosting to GitHub).

---

## 1. What this is
Curlywave OS is the in-house app for **Curlywave** (a marketing agency). The goal is to move the agency's **entire client workflow** into one app:

intake form → AI research → content plan + image prompts → client review → AI check of change requests → image/video generation → Google Drive delivery → client approval → posting → dashboard, tracker, chatbot, employee management.

**Owner:** Shreejal (evocartoonz@gmail.com). The admin account is created by signing up with this email.

## 2. Rules the owner set (always follow)
- **Free tools only.** Keep the app **as independent of third parties as possible**. Before choosing any paid tool: (1) check whether we can build it ourselves, (2) if not, find a cheaper or free alternative, (3) only then decide.
- **Ask before any major change.** Otherwise work independently.
- **Test everything thoroughly, several times.** Find and fix bugs without being asked.
- **Communication style:**
  - Short, direct, honest answers in English.
  - Put questions for him at the **very end, numbered**.
  - Step-by-step instructions, copy-paste over typing.
- **Security rules for Claude:**
  - Never enter passwords or API keys into web pages. He signs in himself; Claude does the rest.
  - `.env` files can't be written to his PC through the remote tools, so config lives in `src/config.ts`.

## 3. Stack (all free tier)
| Part | Tool | Notes |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript, plain CSS | Only 4 runtime deps: react, react-dom, react-router-dom, @supabase/supabase-js |
| Backend | **Supabase** project `curlywave-os` | ref `dwwpxzewdmrnwpulkrwz`, region ap-south-1 (Mumbai), org `baeryfnoramginanirzp` |
| API URL | https://dwwpxzewdmrnwpulkrwz.supabase.co | Publishable key is in `src/config.ts` (public by design; RLS protects data) |
| Hosting | **GitHub Pages**, repo **github.com/anmol-curlywave/curlywave-os** (public) | Live: **https://anmol-curlywave.github.io/curlywave-os/**. Every push to `main` rebuilds through GitHub Actions (`deploy.yml`) |
| PWA | Hand-written service worker (`public/sw.js`), manifest, icons | No workbox. Private API data is never cached |
| Desktop | **Electron** wrapper (`desktop/`) that loads the hosted URL | Built by GitHub Actions (`desktop.yml`) on Windows and macOS runners. Downloads: github.com/anmol-curlywave/curlywave-os/releases/tag/desktop-latest |

Connectors in Claude: **Supabase** is connected, plus Google Drive, Google Calendar and Make. Cloudflare is also connected but is no longer used; he chose GitHub instead.

The cloud sandbox **cannot reach** `*.supabase.co`, `api.github.com` or `api.cloudflare.com`, and has no GitHub credentials. So:
- **GitHub work** happens in the Claude **built-in browser**, where he is signed in to GitHub as **anmol-curlywave**.
- **Live testing** uses the built-in browser on his PC.
- **Database work** goes through the Supabase MCP tools.

**How code gets to GitHub (no tokens needed):**
- **A few files:**
  1. Open `https://github.com/anmol-curlywave/curlywave-os/new/main?filename=PATH` (or `/edit/main/PATH`) in the built-in browser.
  2. Paste the content into the CodeMirror editor with a synthetic `paste` event (`document.querySelector('.cm-content')` + `DataTransfer`).
  3. Click **Commit changes...**, then **Commit changes**.
- **Many files:** use the `bootstrap.yml` workflow.
  1. Commit `bootstrap/bundle.sha256`.
  2. Commit `bootstrap/bundle.b64` (base64 of a tar.gz of the files, excluding `.github`). To get the large text into the browser, publish it as a claude.ai artifact, then copy and paste it.
  3. The workflow verifies the checksum, unpacks, commits, deletes the bundle and triggers the deploy and desktop builds.
  - The bot cannot change `.github/workflows/*`; edit those through the web editor.
- **From his PC:** `publish.bat` (git push). GitHub is the main copy.

His PC ("anmol-pc", Windows) has Node.js and Git installed. The code folder is `C:\Users\User\Desktop\Curlywave-OS`.

## 4. Roles & security
- **admin:** everything.
- **employee:** only clients where `assigned_employee_id` = them, plus tasks assigned to them or on their clients. Cannot reassign clients, change the client code or change roles.
- **client:** no raw table access. Only sees `rpc my_projects()`, which shows:
  - the content plan link from stage *client_review* onwards
  - the Drive link from stage *delivery* onwards
- **pending:** anyone who self-signs-up. Sees nothing until an admin approves them on the Team page.
- The first admin is set by `app_settings.admin_bootstrap_emails` = `["evocartoonz@gmail.com"]`.
- Role helper functions live in the **`private`** schema (`private.is_admin()`, `private.is_staff()`, `private.my_role()`), not exposed through the API.
- Admin user management goes through edge function **`admin-users`** (verify_jwt on, checks the caller is admin). Actions:
  - `create {email,password,full_name,role,designation,phone,client_id?}`
  - `update {user_id, role?, is_active?, ...}`. Deactivating also bans the auth user.
  - `reset_password {user_id,password}`
- DB timezone is **Asia/Kolkata**.

## 5. Database (migrations in `supabase/migrations`, all already applied)
- `0001_phase1_core`:
  - Enums: `user_role`, `pipeline_stage` (intake, research, content_plan, client_review, revisions, generation, delivery, final_approval, posting, completed), `task_status` (todo, in_progress, review, done, blocked), `task_priority`.
  - Tables: `app_settings`, `stage_settings` (days allowed per stage and the auto-task title), `profiles`, `clients`, `client_rules`, `tasks`, `activity_log`.
  - Views (security_invoker): `client_overview` (progress %, open/overdue tasks, `is_delayed`, `days_left`) and `employee_workload`.
  - RLS on everything; anon has no access.
- **Triggers (automation):**
  - A new auth user gets a profile.
  - A stage change sets `stage_started_at` and `stage_due_date` (from the stage's days allowed), closes the old stage's auto task, creates a new auto task for the assigned employee, and logs activity.
  - Reassigning a client moves its open auto tasks to the new employee.
  - A task status change sets `completed_at` and logs activity.
  - Guard triggers stop non-admins changing roles or client ownership; the service role bypasses them.
- `0002_harden_functions` moves helpers to `private`. `0003_guards_allow_service` lets the service role through the guards. `0004_portal_gating` adds the portal link rules. `0005_timezone_ist` sets IST.
- Security advisor: clean. The only notice is `my_projects` being callable by signed-in users, which is intended.

## 6. App structure (`src/`)
- `config.ts`: Supabase URL and publishable key.
- `lib/`:
  - `supabase.ts`: client, types, stage list, and `adminUsers()`, which calls the edge function.
  - `auth.tsx`: session, profile, profile error and password-recovery mode.
  - `format.ts`: dates, `byCode` (numeric client-code sort), `byTaskPriority`, `randomPassword`.
  - `pwa.ts`: service worker registration and update flow; `isDesktopApp()` checks for "CurlywaveDesktop" in the user agent.
  - `useRefresh.ts`: reloads data when the window regains focus (instead of paid realtime).
- `components/`: `Layout` (sidebar per role, mobile menu), `ui` (Modal, Progress, badges, Stepper), `ClientForm`, `TaskForm`, `TaskTable`, `InstallBanner`.
- `pages/`:
  - `Login`: sign in, create account, forgot password, and the expired-link message.
  - `Dashboard` (admin): KPIs, delayed clients, clients by stage, all clients, team workload.
  - `Clients`: search and filters by stage, owner and status.
  - `ClientDetail`: pipeline move buttons, plus tabs for overview, tasks, rules, activity and client login.
  - `Tasks`: list or board. Employees see a "My tasks" home.
  - `Employees` (Team): approve pending users, add members, workload.
  - `EmployeeDetail`: role, reset password, disable login, clients handled, pending work.
  - `Settings`: days allowed per stage and auto-task titles.
  - `Portal` (client).
  - `Account`: own name, phone and password. Also the "set new password" screen.

## 7. Testing
- `tests/ui.test.mjs` + `tests/mock-backend.mjs`: Playwright with an in-memory fake Supabase that mirrors RLS. It covers:
  - 4 roles, on desktop, tablet and mobile, in light and dark mode
  - access control
  - all main flows
  - horizontal-overflow checks
  - PWA checks (manifest, icons, service worker, offline)
  - **Last run: 218/218 passed.**
  - To run: `npm run build`, then `npx vite preview --port 4173`, then `node tests/ui.test.mjs`. The Playwright path is hard-coded to the Claude sandbox's global install.
- `desktop/tests/desktop.test.mjs`: Playwright + Electron under xvfb. **Last run: 10/10 passed.** Set `CURLYWAVE_APP_URL` to point the desktop app at another URL; this only works when not packaged.
- Database RLS/trigger test: a SQL `DO` block that acts as each role and ends with `raise exception 'ALL_TESTS_PASSED'`, so everything rolls back. **Last run: 13/13 passed.**
- **Test accounts exist in Supabase:** `qa-admin@`, `qa-emp1@`, `qa-emp2@`, `qa-client@`, `qa-stranger@curlywave.test`. **Delete them once live testing is done**, or before real use.

## 8. Build notes
- **Web:** `npm run build` produces `dist/`. A vite plugin in `vite.config.ts` stamps the service worker version and copies `index.html` to `404.html` so GitHub Pages serves the app on every path.
  - The app works under any base path: `BASE_PATH=/curlywave-os/ npm run build`. `deploy.yml` sets this automatically.
  - The router, manifest, service worker and icons all follow `import.meta.env.BASE_URL`.
- **Desktop:**
  - Normally built by GitHub Actions (`desktop.yml`). It sets `appUrl` automatically, ad-hoc signs the Mac apps (`-c.mac.identity=-`) and publishes to the `desktop-latest` release.
  - For a local build, `desktop/config.json` `appUrl` is `https://anmol-curlywave.github.io/curlywave-os/`.
  - **Windows** (from Linux): needs `wine` + `wine32:i386`. Run `npx electron-builder --win --x64`.
  - **Mac** (from Linux): run `npx electron-builder --mac --x64 --arm64`. This builds unsigned zips. Ad-hoc sign each `.app` with **rcodesign** (`rcodesign sign "Curlywave OS.app"`) so Apple Silicon doesn't report it as "damaged", then re-zip with `zip -ry`.
  - Installers are 80–100 MB, too big for the device file tool (20 MB limit). Point people to the GitHub release downloads instead.
- The apps are unsigned (signing is paid), so on first launch Windows shows "Run anyway" and Mac needs right-click → Open. **The PWA is the recommended desktop option:** no warnings, and it updates itself.

## 9. Status
**Done:**
- Phase 1: logins and roles, clients and pipeline, auto tasks, dashboard, team management, client portal, settings, my account
- PWA
- Desktop builds
- Bug-fix pass

**Waiting on Shreejal:**
1. Sign up as admin with evocartoonz@gmail.com on the live site.
2. (Done) GitHub repo created as public, and Pages enabled with source = GitHub Actions.
3. Give permission to set the Supabase Auth **Site URL** and redirect URLs (live URL + `http://localhost:5173`) in the dashboard through the built-in browser.
4. Confirm whether he wants the desktop installers or the PWA only.
5. Answer whether to import existing clients from the master posting Google Sheet (ID `1vJfnHacCixr1M-Gu1unrcViRQvobCYH9fQblJRNlyWc`, Clients tab).

**Next after that:**
1. Check that the GitHub Actions runs succeed and the release downloads appear.
2. Run a live end-to-end test on the real backend (built-in browser, and install the Windows app via computer use).
3. Delete the QA accounts.

**Known limitation:** Supabase's free email only sends to the project owner, so "Forgot password" emails won't reach employees. Admins reset passwords on the Team page. Fix later with free Gmail SMTP.

## 10. Roadmap
- **Phase 2:** In-app intake form (and import of existing Google Form responses), AI research, and content plan + image prompts.
  - AI: Gemini API free tier. The owner will paste the key into Supabase secrets himself.
  - Keep the **locked content-plan format**: reuse the existing content-plan-workflow skill's `build_plan.py` (plan.json → DOCX + Image_Prompts TXT).
  - Per-client rules from `client_rules` are injected into every AI step.
- **Phase 3:** Client plan approval in the portal. Change requests are checked by AI; good ones are applied, and weak ones get a detailed explanation that staff approve before it's sent.
- **Phase 4:** Image/video **worker** on the automation PC that polls a Supabase job queue.
  - Reuse the existing ChatGPT image automation (Node + Playwright, account switching) and the Google Flow/Veo video automation.
  - Upload to Drive folder `#ID-Name`, share the link with the client.
- **Phase 5:** Posting. Plan: call Buffer's API directly from a Supabase edge function plus cron, to drop the Make.com dependency. The current Make scenario is ID 6805480, team 2228735, and the Buffer free plan allows 10 queued posts per channel. Add a posting tracker.
- **Phase 6:** Chatbot in the client portal, then WhatsApp through **OneClick** (Curlywave's own WhatsApp automation product). Hands over to a human when needed; if the client asks for a call, it notifies the team with a situation summary.
