# Curlywave OS

> **New chat with Claude?** Upload `PROJECT_CONTEXT.md` — it has the full project state, decisions and next steps.

Agency workflow app for Curlywave — clients, pipeline, tasks, team, client portal.

## Run it on this PC
Double-click **start.bat** (needs Node.js). It opens http://localhost:5173.

## Live app
- Web / PWA: https://anmol-curlywave.github.io/curlywave-os/
- Desktop downloads (Windows, Mac): https://github.com/anmol-curlywave/curlywave-os/releases/tag/desktop-latest

Every change pushed to GitHub (`main`) rebuilds the website and desktop apps automatically. From this PC, double-click **publish.bat** to push local changes.

## Stack (all free tier)
- **Frontend:** React + Vite (this folder)
- **Backend:** Supabase project `curlywave-os` (Mumbai) — database, logins, security rules, edge functions
- **Hosting:** GitHub Pages + GitHub Actions (free)

## Roles
- **Admin** — everything: dashboard, all clients, all tasks, team, settings
- **Employee** — only their own tasks and assigned clients
- **Client** — portal showing their project progress (plan link from client-review stage, Drive link from delivery stage)
- **Pending** — anyone who self-signs-up; sees nothing until an admin approves them on the Team page

The first admin is whoever signs up with an email listed in the `admin_bootstrap_emails` setting (currently evocartoonz@gmail.com).

## Folders
- `src/` — app code (pages, components, lib)
- `supabase/migrations/` — database schema, in order (already applied)
- `supabase/functions/admin-users/` — admin-only user management (already deployed)

## Phases
1. Logins, clients, pipeline, tasks, team, dashboard, client portal, PWA, desktop apps  ← **done**
2. Intake form + AI research + content plan & prompt generation
3. Client approval + change-request validation
4. Image/video worker (runs on the automation PC) + Google Drive delivery
5. Posting (Buffer) + posting tracker
6. Chatbot + human handover + call requests (portal, then WhatsApp via OneClick)
