# Handoff

Start here. Written Sun 1 Nov 2026, for a new Claude Code session in the terminal. Read this, then the root `CLAUDE.md`, then `docs/DEMO.md`. `docs/PLAN.md` holds the wider plan and the pitch content.

**Goal:** a complete application and a working demo for the SAP Hackfest Grand Finale. Build closes **Tue 3 Nov**. Finale is **Wed 4 Nov**.

## Rules from Anuj

- **Claude never commits or pushes, and doesn't offer to.** Tell Anuj what to commit.
- **No interviews.** Anuj decided against them, so don't bring them up again. Slides use published research only.
- Anuj wants direct steps, one at a time, in plain language, with links. Don't ask him to choose when there's a clear best option.
- Never ask for or handle passwords, API keys or one-time codes. Anuj enters those himself.

## What works now

**Product flow, set by Anuj on 2 Nov:** see "The product" in the root `CLAUDE.md`. The app was rebuilt around it that day, on SAP Fiori components.

| Part | State |
|---|---|
| Backend, seven agents, certificates, companies, EWM upload, outside applications, mock SuccessFactors | Built. 32 unit tests and `npm run journey` pass locally, with AI through SAP Generative AI Hub. |
| Web app (`app/web`) | Sign-in page, launchpad, worker, manager, SAP landscape and public check screens. The worker, manager and other-company flow was run in a browser locally, plus Hindi and phone width. |
| Live on SAP BTP | The rebuilt app was deployed on 2 Nov, and the seed data is loaded in HANA. The public sign-in page loads, the app redirects to SAP sign-in, and the backend reports the Generative AI Hub route. |

**Live run on 2 Nov:** steps 1 to 14, 16 and 17 of `docs/DEMO.md` passed once on BTP in English, with typed input and real AI through SAP Generative AI Hub (no backup used). Reset demo data also passed.

**Also live and checked on BTP, 2 Nov:** the employee profile, the View As switch, How It Works and step 15 (Arjun replies, Ravi reads it). Screens opened as each person; the chain before step 15 was driven through the same backend calls.

**Not yet tested on BTP:** sign-out and Hindi. Also untested: voice with a real microphone or phone, printing a certificate, and the Hindi wording by a Hindi speaker.

## BTP facts

| Item | Value |
|---|---|
| App | https://eb72796ftrial-dev-frontline-shift.cfapps.ap21.hana.ondemand.com |
| Manager screens | Same URL plus `#/manager` |
| Public check page | Same URL plus `/check.html#<token>` |
| Cockpit (subaccount) | https://account.hanatrial.ondemand.com/trial/#/globalaccount/33eb018d-ce30-4e7a-92a7-0184752d0647/subaccount/0f9c261b-782b-4d6c-8672-0b545203462b/subaccountoverview |
| CF API endpoint | `https://api.cf.ap21.hana.ondemand.com` |
| Org and space | `eb72796ftrial`, `dev` (Singapore, Azure) |
| HANA instance | `frontline-db`, free tier, Cloud Foundry IPs only |
| Apps | `frontline-shift` (Approuter), `frontline-shift-srv`, `frontline-shift-db-deployer` (runs once) |
| Ravi's worker ID | `00000000-0000-4000-8000-000000000001` (fictional) |

`PASSPORT_SECRET` and `DEMO_WORKER_ID` (Ravi's ID) are already set on `frontline-shift-srv`. With `DEMO_WORKER_ID` set, any Worker login with no `workerId` attribute acts as Ravi, so the `ravi-attribute` role isn't needed for the demo, and any manager login not in `DEMO_STAFF_MAP` acts as Meera. See `srv/lib/demo-worker.js`. `cf`, the `multiapps` plugin, `mbt` and GNU Make are installed.

## Things that will catch you out

- **HANA stops by itself**, even the same day. A deploy then fails with "HANA Database instance is stopped". Fix: `cf update-service frontline-db -c scripts/hana-start.json`, wait about 3 minutes, then retry with the `cf deploy -i <id> -a retry` command from the error.
- **The trial also stops the apps overnight.** The site then shows `404 Not Found: Requested route`. Fix: `cf start frontline-shift-srv`, then `cf start frontline-shift`.
- **"Unauthorized" after signing in** means the sign-in page sat open too long. Open the app link again.
- **A deploy or restart of `frontline-shift` ends every session.** An open page now reloads and signs in again by itself, and goes back to the first tab.
- **The cockpit needs Chrome.** Entitlements gave 403 errors in the Claude desktop app's built-in browser, though the same pages worked in Chrome.
- **`cf login` needs Anuj.** It's `cf login -a https://api.cf.ap21.hana.ondemand.com --sso`, and he pastes the code. If `cf` commands say not logged in, ask him to do this.
- **SAP AI Core comes from a shared tenant, not this trial.** `scripts/aicore-key.ps1` saves its key to `.env`. The tenant has several orchestration deployments and some refuse `gpt-4.1` (403 "not allowed"), so `AICORE_DEPLOYMENT_ID` pins the working one (`orchestration-trial`). Other deployments there belong to other people, so leave them alone. Never print or commit the key.
- **A locked file stops `mbt build`.** `npm ci --prefix app/web` fails with EPERM on `rolldown-binding…node` if any `cds watch` or Vite process is still running, and it leaves `app/web/node_modules` half deleted. Stop every `npm run watch` first, then run `npm ci --prefix app/web`.
- **SQLite doesn't enforce text lengths, but HANA does.** Clip LLM text to fit `db/schema.cds`, and don't assume a local pass means HANA will pass.
- **XSUAA sends attributes as lists.** Use `srv/lib/worker-id.js`, not `req.user.attr.workerId`.
- **`npm run watch` restarts on every file save**, and it picks a random port if 4004 is taken. Make sure no old server is running before you run the journey, and stop yours afterwards.
- **A new seed CSV for a table that already has rows fails the deploy** ("include_filter definitions match with N records"). Empty that table once, then retry. It only happens the first time a CSV is added.
- **Editing seed CSVs needs a redeploy** to reach HANA, and a deploy reloads those tables, which resets the demo state.

## Local commands

Backend, in one terminal:
```bash
npm run watch
```
Web app, in another:
```bash
npm --prefix app/web run dev
```
Then open http://localhost:5173. Check everything with:
```bash
npm test
```
```bash
npm run journey
```

Deploy:
```bash
mbt build
```
```bash
cf deploy mta_archives/frontline-shift_1.0.0.mtar -f
```

## What's left, in order

**Steps 1 to 4 below are done, and the demo steps changed.** The order now is: Anuj runs `docs/DEMO.md` on the live URL, optionally adds a second login for Arjun, then does steps 5 and 6.

### 1. Anuj commits the current work
Everything since commit `23ec669` is uncommitted on branch `scaffold-cap`. All of it is safe to commit, because `.env` is ignored.

### 2. Anuj gives himself access (in Chrome, on the cockpit link above)
1. **Security → Users**, his email, **Assign Role Collection**: Worker, Manager, Supervisor, HRAdmin, all ending in `(frontline-shift eb72796ftrial-dev)`.
2. **Security → Roles → Create**: template `userattributes` from the `frontline-shift` app, name `ravi-attribute`, `workerId` source **Static**, value Ravi's worker ID. Add it to the role collection `userattributes (frontline-shift eb72796ftrial-dev)`.
3. Assign that `userattributes` role collection to himself.
4. Log out, then open the app in an Incognito window.

### 3. Test the live app end to end
Anuj follows `docs/DEMO.md` on the live URL and reports what happens. Fix what breaks, then redeploy. Likely trouble spots: login redirect, CSRF on POST (`src/api.ts`), the `workerId` attribute reaching the app, and timestamps from HANA.

### 4. Real AI on the live app
Route order: SAP Generative AI Hub, then direct Anthropic, then Google Gemini, then the marked offline backup.
Done locally. On BTP `AICORE_SERVICE_KEY`, `LLM_MODEL` and `AICORE_DEPLOYMENT_ID` are set on `frontline-shift-srv`, but the app still needs a redeploy with the latest `srv/lib/llm.js` (it adds the deployment pin). After that, confirm `/worker/aiStatus()` says `generative-ai-hub` and the trace shows "SAP Generative AI Hub".
Backup: a free Gemini key from https://aistudio.google.com/apikey, set with `cf set-env frontline-shift-srv GEMINI_API_KEY <key>`. It only applies if the Hub and Anthropic routes aren't configured.

### 5. Prove the demo
Three clean runs in a row on the live URL. Test voice in Chrome with a real microphone. Fix anything rough.

### 6. Pitch and backup
1. Slides, using `docs/PLAN.md` sections 2 and 6 to 10. A 10-minute talk, and all five members speak.
2. Backup video of the whole run from the live URL.
3. Two process diagrams (before and after) in SAP Signavio if access works. It's optional, so do it after the app.
4. Rehearse twice with a timer.

### 7. Only if everything above is done
SAP sandbox API call, SAP Analytics Cloud story, SAP Document AI, Signavio Process Intelligence.

## Out-of-date material

- **Architecture page** (https://claude.ai/artifact/DfqnwXcHN89kbnJkotfNiK) and its PDF: still show HANA vector search, BTP CI/CD and four languages as built, Generative AI Hub as the LLM, agents D and F using the LLM, and 15 tables. The app has none of those vector or CI/CD parts, only agents A and B use an LLM, and there are 16 tables. Update it, or don't show those parts to the jury. The HTML and PDF are in `C:\Projects\SAP\FrontlineShift`, a repo Anuj no longer uses.
- **Root `CLAUDE.md`** names team owners per folder. Anuj is doing the work himself right now, so treat them as optional.
