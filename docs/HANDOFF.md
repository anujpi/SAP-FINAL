# Handoff

Start here. Written Sun 1 Nov 2026, for a new Claude Code session in the terminal. Read this, then the root `CLAUDE.md`, then `docs/DEMO.md`. `docs/PLAN.md` holds the wider plan and the pitch content.

**Goal:** a complete application and a working demo for the SAP Hackfest Grand Finale. Build closes **Tue 3 Nov**. Finale is **Wed 4 Nov**.

## Rules from Anuj

- **Claude never commits or pushes, and doesn't offer to.** Tell Anuj what to commit.
- **No interviews.** Anuj decided against them, so don't bring them up again. Slides use published research only.
- Anuj wants direct steps, one at a time, in plain language, with links. Don't ask him to choose when there's a clear best option.
- Never ask for or handle passwords, API keys or one-time codes. Anuj enters those himself.

## What works now

| Part | State |
|---|---|
| Backend, seven agents, Skill Passport | Built. 19 unit tests and `npm run journey` pass locally. |
| Web app (`app/web`) | Worker, manager and public check screens. The full journey was run in a browser locally, in English and Hindi. |
| Live on SAP BTP | Deployed with HANA Cloud and XSUAA. All 15 steps in `docs/DEMO.md` passed on the live URL in English on 2 Nov, with typed input and the offline AI backup. |

**Not yet tested:** a real LLM reply on any route, voice with a real microphone or phone, Hindi on the live URL, and the Hindi wording by a Hindi speaker.

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

`PASSPORT_SECRET` and `DEMO_WORKER_ID` (Ravi's ID) are already set on `frontline-shift-srv`. With `DEMO_WORKER_ID` set, any Worker login with no `workerId` attribute acts as Ravi, so the `ravi-attribute` role isn't needed for the demo. See `srv/lib/demo-worker.js`. `cf`, the `multiapps` plugin, `mbt` and GNU Make are installed.

## Things that will catch you out

- **HANA stops by itself**, even the same day. A deploy then fails with "HANA Database instance is stopped". Fix: `cf update-service frontline-db -c scripts/hana-start.json`, wait about 3 minutes, then retry with the `cf deploy -i <id> -a retry` command from the error.
- **The trial also stops the apps overnight.** The site then shows `404 Not Found: Requested route`. Fix: `cf start frontline-shift-srv`, then `cf start frontline-shift`.
- **"Unauthorized" after signing in** means the sign-in page sat open too long. Reload the app link.
- **The cockpit needs Chrome.** Entitlements gave 403 errors in the Claude desktop app's built-in browser, though the same pages worked in Chrome.
- **`cf login` needs Anuj.** It's `cf login -a https://api.cf.ap21.hana.ondemand.com --sso`, and he pastes the code. If `cf` commands say not logged in, ask him to do this.
- **SAP AI Core isn't offered on this trial**, so Generative AI Hub is unavailable unless the organisers or SAP's separate trial give a key.
- **SQLite doesn't enforce text lengths, but HANA does.** Clip LLM text to fit `db/schema.cds`, and don't assume a local pass means HANA will pass.
- **XSUAA sends attributes as lists.** Use `srv/lib/worker-id.js`, not `req.user.attr.workerId`.
- **`npm run watch` restarts on every file save**, and it picks a random port if 4004 is taken. Make sure no old server is running before you run the journey, and stop yours afterwards.
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

### 1. Anuj commits the current work
Everything since commit `d34dcd4` is uncommitted on branch `scaffold-cap`. All of it is safe to commit, and `.env` doesn't exist yet.

### 2. Anuj gives himself access (in Chrome, on the cockpit link above)
1. **Security → Users**, his email, **Assign Role Collection**: Worker, Manager, Supervisor, HRAdmin, all ending in `(frontline-shift eb72796ftrial-dev)`.
2. **Security → Roles → Create**: template `userattributes` from the `frontline-shift` app, name `ravi-attribute`, `workerId` source **Static**, value Ravi's worker ID. Add it to the role collection `userattributes (frontline-shift eb72796ftrial-dev)`.
3. Assign that `userattributes` role collection to himself.
4. Log out, then open the app in an Incognito window.

### 3. Test the live app end to end
Anuj follows `docs/DEMO.md` on the live URL and reports what happens. Fix what breaks, then redeploy. Likely trouble spots: login redirect, CSRF on POST (`src/api.ts`), the `workerId` attribute reaching the app, and timestamps from HANA.

### 4. Real AI
Anuj creates an Anthropic API key with a spending limit. Locally he puts it in `.env`. On BTP he runs this himself, then restarts the app:
```bash
cf set-env frontline-shift-srv ANTHROPIC_API_KEY his-key-here
```
Claude can then run `cf restart frontline-shift-srv`. Confirm `/worker/aiStatus()` says `direct-anthropic`, and test agents A and B with real English and Hindi answers, including mixed language and an attempt to inject instructions. The system trace must show the true route.

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
