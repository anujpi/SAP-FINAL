# Showing every feature to the judges

One file with everything: what to type, what to upload, which buttons to press, and what should appear. All people, companies and records are fictional sample data.

**App:** https://eb72796ftrial-dev-frontline-shift.cfapps.ap21.hana.ondemand.com/welcome.html

**Checked on 4 Nov 2026:** every step below ran end to end with `node scripts/demo-check.js` (English and Hindi), plus 38 tests and the full journey. The outside-hire screens were also clicked through by hand: Arjun asks, Ravi shares 3 certificates, Arjun sees his name and invites him, Ravi gets the notification.

---

## 1. Before you go on stage

| # | Do | Check |
|---|---|---|
| 1 | Start HANA: `cf update-service frontline-db -c scripts/hana-start.json` | `cf service frontline-db` says **HanaService is ready** (up to 20 min) |
| 2 | If the site shows `404 Not Found`, run `cf start frontline-shift-srv` and `cf start frontline-shift` | Front page loads. Refresh once if it says "Pool resource could not be acquired" |
| 3 | Sign in as **Meera** (your SAP ID) → your initials → **Start over with sample data** | Ravi is back to *Warehouse Operator*, 0% |
| 4 | Sign in as **Ravi** (Swastik's SAP ID, incognito) and **Arjun** (college SAP ID, another browser) | Each sees their own name, with no View As switch |
| 5 | On the laptop, keep ready: `docs/ewm-extract-2026-11-03.csv` and a 3–5 second phone video (under 8 MB) of someone updating a stock sheet or screen | |

The bell at the top right shows each person's notifications and refreshes every 20 seconds. Press F5 if you don't want to wait.

## 2. The sample data you'll use

**The job Ravi becomes ready for:** *Digital Supply Chain Coordinator*, requisition REQ-1001 at Indigo Hub Logistics (his own company).

| Skill the role needs | Weight | How Meera proves it on stage | Match after |
|---|---|---|---|
| Cycle counting | 36% | EWM records (already in HANA: 46 tasks) | |
| Stock discrepancy resolution | 32% | EWM records (already in HANA) | |
| Dispatch coordination | 12% | EWM records (already in HANA) | **80%** |
| Inventory system transactions | 12% | EWM records, **only after you upload the CSV** (21 stock transfers over 3 days) | **92%** |
| Digital stock reporting | 8% | **Video of the work** (no system records it) | **100%** |

**What Ravi types (or says) to record his skills.** It covers all five:

- English: `I count the bins every week and fix any stock mismatch with an adjustment. I load the trucks for dispatch, enter goods movements on the scanner, and update the daily stock report on the dashboard.`
- Hindi: `मैं हर हफ्ते बिन की गिनती करता हूँ और स्टॉक के फर्क को एडजस्टमेंट से ठीक करता हूँ। मैं डिस्पैच के लिए ट्रक लोड करता हूँ, स्कैनर पर सिस्टम एंट्री करता हूँ, और डैशबोर्ड पर रोज़ की स्टॉक रिपोर्ट अपडेट करता हूँ।`

The AI finds 9 skills from this: the 5 above, *barcode scanning* (only said, no record), and *putaway, picking, goods receiving* (never said, but EWM shows them).

**The EWM file** `docs/ewm-extract-2026-11-03.csv`: 47 rows, 8 operators, 1–3 Nov. Ravi is `BLR1-OP001`. Format, if a judge asks:

```
ewmUser,workDate,taskType,confirmedTasks
BLR1-OP001,2026-11-01,STOCK_TRANSFER,6
BLR1-OP001,2026-11-02,STOCK_TRANSFER,8
BLR1-OP001,2026-11-03,STOCK_TRANSFER,7
```

EWM task → skill: `STOCK_TRANSFER` → Inventory system transactions, `PHYSICAL_INVENTORY` → Cycle counting, `DIFFERENCE_POSTING` → Stock discrepancy, `GOODS_ISSUE` → Dispatch. A skill counts as "seen in work records" at 5+ tasks over 2+ days.

**Outside hiring:** Arjun (Meridian Freight) has two open roles: *Inventory Controller, Hosur* and *Digital Supply Chain Coordinator, Chennai*. Six people at other companies are already open to offers, so Arjun sees 7 anonymous candidates once Ravi opts in, with Ravi at the top at 100%.

---

## 3. The run (about 9 minutes)

### Part A: Ravi gets ready for the job

| # | Who | Do | You should see | Say |
|---|---|---|---|---|
| 1 | Front page | Scroll, open **How it works** | | "The people you need next are already on your floor." |
| 2 | Ravi | Pick **English** or **हिन्दी**, agree to consent | Home screen, match 0% | "Consent first, in his own language." |
| 3 | Ravi | **Record a new skill** → **Talk** or **Type instead** → paste the answer above → confirm the read-back | 9 skills | "SAP's AI turns his words into skills from a real skills library. He checks them before anything is saved." |
| 4 | Ravi | **Skills** tab | 3 skills say "Seen in work records" with task counts. Putaway says "You didn't mention this, but your work records show it". Match still **0%** | "EWM proves the work happened. AI never verifies. Only a person can." |
| 5 | Ravi | **Ask my manager to verify** on all 5 role skills | | "He asks his manager." |

### Part B: Meera verifies with proof

| # | Who | Do | You should see | Say |
|---|---|---|---|---|
| 6 | Meera | Bell shows **5** → **Verification requests** | 5 requests, 3 with EWM task counts | |
| 7 | Meera | Cycle counting, Stock discrepancy, Dispatch → proof **EWM records** → **Verify** (each) | Ravi's bell: "Meera S. verified…". Ravi's **Jobs**: **80%** | "The proof is the EWM record. Only verified skills score, and the score is plain code, not AI." |
| 8 | Meera | **EWM daily upload** → choose the CSV → **Load into HANA** | "Extract loaded into HANA." The recent-uploads list shows the new days | "Last night's EWM extract goes into HANA." |
| 9 | Meera | **Verification requests** → Inventory system transactions now shows **21 tasks** → **EWM records** → **Verify** | Ravi: **92%** | "The upload just backed up what he said." |
| 10 | Meera | Digital stock reporting → proof **Video of the work** → pick the clip (it plays) → **Verify** | Ravi: **100%** | "No system records this, so she attaches a short clip. It stays inside the company." |

Notice that the reference box changes with the proof type: EWM is prefilled, *Observed on shift* asks for a date and what she saw, *Training record* asks for a TRN number, and *Video* needs the clip before **Verify** works.

### Part C: certificate, resume, promotion

| # | Who | Do | You should see | Say |
|---|---|---|---|---|
| 11 | Ravi | **Certificates** | 5 certificates: number, Meera's name, company, proof, seal. **Print** works | "Which manager, which company, how it was proven." |
| 12 | Ravi | **Resume** | Only the 5 verified skills, never what he simply said | "Garbage in a voice note never reaches his resume." |
| 13 | Ravi | **Jobs** → **Ask my manager to review** on Digital Supply Chain Coordinator | | |
| 14 | Meera | **Role reviews** → Ravi: 100%, verified skills, evidence, what goes to SuccessFactors → **Move into this role** → **Record decision** | | "AI recommends, people decide." |
| 15 | Ravi | Bell: "Congratulations!" | Header now says **Digital Supply Chain Coordinator** | "Warehouse operator to coordinator, on proof." |
| 16 | Meera | **My employees** → Ravi → **Watch clip**. Then **Find talent** → *Cycle counting* | The clip plays. 4 people with verified cycle counting | "HR filters people by verified skill, as in SuccessFactors." |

### Part D: hiring from outside (Arjun, another company)

| # | Who | Do | You should see | Say |
|---|---|---|---|---|
| 17 | Ravi | **Jobs** → tick **Also show sample jobs at other companies** | Meridian and Cauvery jobs appear with his match | "He chooses to be findable. His employer never sees this." |
| 18 | Arjun | **Hire from outside** → *For this role*: **Digital Supply Chain Coordinator · Chennai** | 7 anonymous candidates. The top one is 100% with 5 verified skills. No names, no employer | "Other companies see skills and a score. Nothing else." |
| 19 | Arjun | Type a message (e.g. `We have a coordinator role in Chennai. Would you like to talk?`) → **Ask to connect** on the 100% candidate | "Request sent to candidate …". Under *Requests you've sent*: "Waiting for their answer" | |
| 20 | Ravi | Bell: "A company wants to connect" → **Requests** tab | "Meridian Freight wants to connect", role and site, Arjun's message | |
| 21 | Ravi | Tick 3 certificates (e.g. Cycle counting, Stock discrepancy, Inventory system transactions) → **Share and connect** | "Meridian Freight · Can see" with the 3 skills | "He picks exactly what to share, and with whom." |
| 22 | Arjun | **Outside applicants** | **Ravi K.**, "Certificates are genuine and not altered", the 3 skills with Meera's name and company | "Now they see his name, because he said yes." |
| 23 | Arjun | Message `Can you come to Chennai on Monday at 10?` → **Invite to interview** | "Ravi K. invited to interview" | |
| 24 | Ravi | Bell: "Meridian Freight invited you to an interview…" | | |
| 25 | Ravi | **Requests** → **Take back permission** (optional) | Arjun's applicants page now says "Permission withdrawn", and the name is gone | "He can take it back any time." |

### Part E: trust and control (Q&A or the last minute)

| # | Who | Do | You should see |
|---|---|---|---|
| 26 | Meera | **Audit log** | Every hand-off, with no personal content. Ravi's outside-job activity is not there |
| 27 | Meera | **Fairness audit** | Figures by language and contract type, labelled fictional |
| 28 | Meera | **SAP landscape** | Live HANA counts. What's connected and what's a stand-in |
| 29 | Meera | **People and settings** → register `Kavya N.`, `kavya.n@indigohub.example`, Worker, *Picker Packer*, *Bengaluru Hub*, EWM user `BLR1-OP009` | "Registered Kavya N." Only registered emails can sign in |
| 30 | Meera | your initials → **Start over with sample data** | Ravi is back to 0%, ready for the next run |

---

## 4. Test cases you can show if a judge asks "what if…?"

Each one is covered by `npm test`, `npm run journey` or `scripts/demo-check.js`.

| What if… | What happens |
|---|---|
| The AI hears something that isn't true? | It's only "You told us" (self-reported). It never scores and never reaches the resume until a manager verifies it |
| The manager says no? | **Not yet** needs a written reason. The worker sees the reason. Never "Missing" |
| Video proof without a clip? | **Verify** stays disabled. The server also refuses it (400) |
| A file that isn't a video? | Refused |
| Arjun tries to see Meera's people or decide on them? | Blocked (403/404). Each manager sees only their own company |
| Meera tries to move herself into a role? | Blocked: another manager must decide |
| Arjun asks the same person twice for the same role? | Refused: "You have already asked this person about this role" |
| Ravi shares a skill he hasn't verified? | Refused: "Only verified skills can be shared" |
| Someone edits a certificate? | The public check says it's altered. Genuine ones say "genuine and not altered" |
| A stranger signs in with a valid SAP ID? | "Not registered" page, no data |
| Ravi revokes consent? | **Delete my data** erases his records |
| Ravi's company leaves the marketplace? | He can't opt in, and outside companies can't find him |
| The AI service is down? | The next route takes over, or a marked offline fallback. The footer says which |

## 5. If something goes wrong

| Problem | Do this |
|---|---|
| Wrong state mid-demo | Meera → initials → **Start over with sample data**, start Part A again |
| A notification hasn't appeared | Press F5 |
| The AI missed a role skill | Record again with just that sentence, e.g. `I update the daily stock report on the dashboard.` |
| Voice doesn't work | **Type instead** |
| CSV upload says the format is wrong | Use the file from `docs/` unchanged. The header must be `ewmUser,workDate,taskType,confirmedTasks` |
| Site down | Hotspot, then the backup video |

## 6. Rehearse without clicking (local copy only)

```bash
npm run watch
```
```bash
node scripts/demo-check.js
```

This runs Parts A to E against the local server in about a minute, stops at the first step that breaks, and leaves Ravi reset. `LANG_HI=1` runs it in Hindi. `READY=1` stops with Ravi at 100% and open to other companies, which is handy to rehearse Part D on screen. It uses local test logins, so it doesn't run against the BTP site.
