# Web app

Read the root `CLAUDE.md` first. One React, TypeScript and plain CSS app with three parts, talking only to our backend:

| Part | File | URL |
|---|---|---|
| Worker journey and system trace | `src/Worker.tsx` | `/#/worker` |
| Review, attestation, audit, fairness, reset | `src/Manager.tsx` | `/#/manager` |
| Public Skill Passport check (no login) | `src/check.tsx` | `/check.html#<token>` |

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
- Unverified skills must never read as a negative. Scores are labelled as demo data.
- Show the sample-data badge and "No live SAP system is connected" until that changes. Show the active AI route from `/worker/aiStatus()` and a notice when a result is `degraded`.
- Never show managers a worker's outside job matches.
- Voice is optional, and typing is always available. Mic access needs HTTPS or localhost. Chrome sends speech audio to Google, and the consent text says so.
- Tap targets 48px or larger, type 16px or larger, visible focus, labelled controls.
- Disable buttons while a call runs, since the backend has no double-submit protection.
