# Curlywave OS — Project Context (hand-off for a new chat)

> **Starting a new chat?** Upload this file (or the whole zip) and say:
> *"Continue building Curlywave OS from PROJECT_CONTEXT.md. Code is in my Curlywave-OS folder on the Desktop."*
> Last updated: 25 Sep 2026 (compliance + security pass: legal pages, DPDP consent, accessibility, review fixes).

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
| Frontend | React 18 + Vite + TypeScript, plain CSS | 5 runtime deps: react, react-dom, react-router-dom, @supabase/supabase-js, @fontsource-variable/inter (self-hosted font). Icons are inlined Lucide SVGs in `components/Icon.tsx` (no icon library) |
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
- `0006_compliance_and_hardening` (**written, NOT yet applied — Shreejal must paste it into the Supabase SQL editor**; Claude's apply was blocked by the permission check):
  - Admin bootstrap by email only works while **no active admin exists** (self-signups aren't email-verified).
  - `profiles` gets `consent_version`, `consent_at`, `deletion_requested_at` (timestamps set by the server).
  - `guard_task_update` trigger: employees can't reassign tasks (except within their own client), move tasks to other people's clients, or change `auto_generated`/`created_by`.
  - `site_info` table (single row): business/legal details for the public legal pages. Anyone can read; only admins can edit (Settings → Business & legal details). Starts with `[FILL IN: …]` placeholders.
  - The app works before and after 0006 is applied (it checks whether the new columns exist).
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
  - `Account`: own name, phone and password. Also the "set new password" screen. **Your data & privacy**: download my data (JSON), request/cancel deletion.
  - `Legal` (public, no login): `/privacy`, `/terms`, `/cookies`. Business details come from `site_info`. Written for India's DPDP Act 2023. Policy version = `CONSENT_VERSION` in `lib/supabase.ts` — bump it when the policies change and everyone is asked to agree again.
  - `Consent`: shown after sign-in when `consent_version` ≠ current version.
- Compliance / accessibility pieces: `CookieNotice` (one-time, essential storage only, no tracking), signup consent checkbox, `LegalFooter`, `Field` (label ↔ input linking), `ExtLink` + `safeUrl()` (only http/https links; adds `https://`), `rowLink()` (keyboard-openable table rows), skip link, focus outlines, colours meet WCAG AA contrast.

## 7. Testing
- `tests/ui.test.mjs` + `tests/mock-backend.mjs`: Playwright with an in-memory fake Supabase that mirrors RLS. It covers:
  - 4 roles, on desktop, tablet and mobile, in light and dark mode
  - access control
  - all main flows
  - horizontal-overflow checks
  - PWA checks (manifest, icons, service worker, offline)
  - Also: legal pages, cookie notice, signup consent, consent screen, data download/deletion, safe links, link-existing-login, role-change confirm, back button, every form field labelled, keyboard row open, and a "before migration 0006" mode.
  - **Last run: 297/297 passed.**
  - To run: `npm run build`, then `npx vite preview --port 4173`, then `node tests/ui.test.mjs`. The Playwright path is hard-coded to the Claude sandbox's global install.
- `desktop/tests/desktop.test.mjs`: Playwright + Electron under xvfb. **Last run: 10/10 passed.** Set `CURLYWAVE_APP_URL` to point the desktop app at another URL; this only works when not packaged.
- `tests/db/`: runs all migrations on a local Postgres 16 with a stub `auth` schema and checks the rules (see `tests/db/README.md`). **Last run: 22/22 passed.**
- Database RLS/trigger test (live): a SQL `DO` block that acts as each role and ends with `raise exception 'ALL_TESTS_PASSED'`, so everything rolls back. **Last run: 13/13 passed.**
- Test accounts were deleted after live testing. For future live tests, create temporary `qa-*@curlywave.test` users and delete them afterwards.

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
- Desktop apps (built by GitHub Actions)
- Two bug-fix passes

**Live since 25 Sep 2026:**
- Website: https://anmol-curlywave.github.io/curlywave-os/
- Desktop installers: `desktop-latest` release (Windows .exe, Mac arm64/x64 .dmg and .zip)

**Live end-to-end test on the real backend (25 Sep): passed.**
- **Admin:** create client, assign employee, move stage (auto tasks created, closed and reassigned), rules, tasks, activity log in IST, create employee login and client login through the `admin-users` function, dashboard delayed detection.
- **Employee:** sees only their tasks and clients, is redirected away from admin pages, can move the stage.
- **Client portal:** only sees `my_projects`, and the links are gated.
- **Direct API attacks were blocked:** a client reading other tables, a client promoting themself to admin, a client calling the admin function, and anonymous access.

**Done later on 25 Sep:**
- All live-test fixes pushed to GitHub and verified by sha256:
  - Portal "Not set yet"
  - Dashboard "Why late" column
  - TaskForm defaults to the client's employee
  - hidden stepper scrollbar and narrower search box
  - **branching pipeline buttons**: client review → "Changes requested → Revisions" or "Plan approved → Image/Video creation"; revisions → back to review or approved; final approval → changes or "Creatives approved → Posting"
  - **Manage login** button for client logins on the Team page (opens `/employees/:id`, where you can reset the password or disable the login)
- Supabase Auth: Site URL = `https://anmol-curlywave.github.io/curlywave-os/`. Redirect URLs = that URL + `/**` and `http://localhost:5173/**`.
- QA test data was deleted.
- `qa-session` edge function: disabled (returns 410). Delete it in the dashboard.

**Sample data for previewing the employee and client views (safe to delete):**
- Employee **Riya Sharma (Demo Employee)**: `demo-employee@curlywave.test`
- Client login **Rohit Mehta (Demo Client)**: `demo-client@curlywave.test`
- Clients **DEMO1 Sweet Crumbs Bakery (sample)**, at client review with the portal linked, and **DEMO2 FitZone Studio (sample)**, at content plan with 1 overdue task
- The demo users have no password. To log in as them, the admin opens Team → the person → **Reset password**, then signs in in a private window.

**Compliance + security pass (25 Sep, from Shreejal's checklist video + Claude's review):**
- Public Privacy Policy, Terms of Use (incl. payments/refunds → covered by the service agreement) and Cookie Policy; cookie notice; consent at signup and first sign-in (DPDP); download my data; request deletion (admins see requests on the Team page); business details + grievance officer editable in Settings.
- Accessibility: labelled fields, keyboard-openable rows, skip link, focus outlines, modal focus handling, AA colour contrast.
- Review fixes: only safe http(s) links (stops `javascript:` links); confirm before role change / disable / approve; "Link existing login" for client logins; back button from creation goes to client review; stage buttons can't double-fire; admin-users function now reports every error; employees can't reassign or move tasks (0006); admin bootstrap can't be hijacked (0006).
- Signup flow Shreejal wants: people sign up with email + password → an admin approves them as employee or client. For that to work, **Supabase → Authentication → Sign In / Providers → Email → turn OFF "Confirm email"** (the built-in email only reaches team addresses). The admin approval step is the check.
- Not done / needs Shreejal: apply 0006; fill in business details; turn off "Confirm email"; delete the `qa-session` function (still ACTIVE); leaked-password protection needs a paid Supabase plan (skipped: free tools only); a lawyer should review the legal text.

**UI refresh (25 Sep):** style "clean light admin + soft cards" (Shopify-like layout, Runey-like cards), picked by Claude. Inter font, Lucide icons, light sidebar with white active item, KPI tiles with coloured icons (`Kpi`), initials avatars (`Avatar`), rounded tables, stage bars on the dashboard, greeting header, 2-column KPIs on phones. Purple brand kept; dark mode kept. Also fixed: the page no longer reloads itself on the very first visit (service worker install).

**Still open:**
1. The Windows installer hasn't been installed on his PC. It needs him to click "More info → Run anyway" at the SmartScreen warning, which Claude must not bypass.
2. The Mac apps haven't been tried on a real Mac.
3. Import existing clients from the master posting Google Sheet (ID `1vJfnHacCixr1M-Gu1unrcViRQvobCYH9fQblJRNlyWc`, Clients tab)? He hasn't answered.
4. Admin account: **anmol.curlywave@gmail.com** (Anmol Kumar), email confirmed manually. `admin_bootstrap_emails` = [anmol.curlywave@gmail.com, evocartoonz@gmail.com]. Reset emails don't arrive for non-owner addresses, so reset passwords from the Team page or ask Claude.

**Files on his PC that are no longer used:** `deploy.bat`, `public/_redirects`, `public/_headers`, `public/icons/icon-1024.png`. They're safe to delete.

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
