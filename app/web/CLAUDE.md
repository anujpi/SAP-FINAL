# Web app

Read the root `CLAUDE.md` first. One React and TypeScript app built on SAP's UI5 Web Components, so it looks and behaves like SAP Fiori. `styles.css` holds layout only. Colours come from the theme. It talks only to our backend:

| Part | File | URL |
|---|---|---|
| Public product front page, How it works with "Try it" steps, and sign-in, with its own styles in `src/welcome.css` | `src/welcome.tsx` | `/welcome.html` |
| Shell, role routing, sign-out, reset | `src/main.tsx` | `/index.html` |
| Home page with tiles by role | `src/Launchpad.tsx` | `/#/` |
| Worker journey and agent activity panel | `src/Worker.tsx`, `src/WorkerTabs.tsx` | `/#/worker` |
| Employees, verification, role reviews, find talent, EWM upload, outside applicants, audit, fairness | `src/Manager.tsx` | `/#/manager/<section>` |
| Manager overview, and HR's People and settings (register, remove, marketplace switch) | `src/Overview.tsx` | `/#/manager/overview`, `/#/manager/people` |
| One employee's profile | `src/Employee.tsx` | `/#/manager/team/<worker ID>` |
| Post a role, anonymous candidates, requests sent | `src/Hiring.tsx` | `/#/manager/hire` |
| Shared table, status and profile card | `src/ui.tsx` | |
| How it fits around SAP systems, with live HANA counts | `src/Landscape.tsx` | `/#/manager/landscape` |
| Public certificate check (no login) | `src/check.tsx` | `/check.html#<token>` |

`src/api.ts` is the only code that calls the backend. `src/i18n.ts` holds the English and Hindi worker text. Manager screens are English only.

## Run locally

Terminal 1, from the repo root:
```bash
npm run watch
```
Terminal 2:
```bash
npm --prefix app/web run dev
```
Open http://localhost:5173. In development the app logs in as `ravi` on worker screens and `meera` on manager screens. That code path is not in the production build.

## Backend calls

`POST /worker/sendEvent` takes `{ type, payload }`, where `payload` is a JSON string, and its `value` is a JSON string too. `Me.stage` decides which screen to show, so keep no hidden journey state in the browser. See `scripts/journey.js` for every call in order.

## Deploy

`npm run build` writes to `.deploy/app-router/resources`, and the Approuter serves it using `.deploy/app-router/xs-app.json`. Only `/passport/check(...)`, `check.html` and `/assets` are public. Everything else needs login.

## Rules

- Never render "Missing". Use "Needs evidence".
- Unverified skills must never read as a negative. Scores are labelled as sample data.
- Keep saying "sample data" and "No customer SAP system is connected yet" until that changes. Say "sample data", "stand-in" or "not connected yet", not "demo" or "mock". Show the active AI route from `/worker/aiStatus()` and a notice when a result is `degraded`.
- Never show managers a worker's outside job matches.
- Voice is optional, and typing is always available. Mic access needs HTTPS or localhost. Chrome sends speech audio to Google, and the consent text says so.
- Tap targets 48px or larger, type 16px or larger, visible focus, labelled controls.
- Disable buttons while a call runs, since the backend has no double-submit protection.
