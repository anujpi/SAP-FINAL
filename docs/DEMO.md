# Demo runbook

The exact steps to show Frontline Shift working. Rehearse from this file. All people and data are fictional.

**App:** https://eb72796ftrial-dev-frontline-shift.cfapps.ap21.hana.ondemand.com/welcome.html

**The story:** Ravi goes from 0% to 100% for *Digital Supply Chain Coordinator* (requisition REQ-1001 at his own company), and Meera moves him into the role. Every step is live.

**For the full feature walk-through with every input, test case and expected result, use [JUDGES.md](JUDGES.md).**

## One hour before

1. **Start HANA.** The free tier stops by itself, even within a day, so assume it's stopped. Run `cf update-service frontline-db -c scripts/hana-start.json`. Allow up to 20 minutes, and check `cf service frontline-db` says **HanaService is ready**. Then open the app once and refresh if the first page says "Pool resource could not be acquired".
2. **Start the apps.** If the site shows `404 Not Found: Requested route`, run `cf start frontline-shift-srv`, then `cf start frontline-shift`.
3. Sign in as Meera, click your initials, then **Start over with sample data**. This resets Ravi, his job title, hiring requests and any uploaded EWM days, so every run starts the same. Do it after each rehearsal and after every deploy.
4. On the demo laptop, keep ready: `docs/ewm-extract-2026-11-03.csv` and a 3–5 second phone clip of someone updating a stock report (under 8 MB). Also the hotspot, charger, projector adapter and the backup video.

## Who signs in

Each person has their own SAP login (set in `DEMO_LOGINS` on BTP):

| Window | Account | Person |
|---|---|---|
| Normal Chrome | Your own SAP ID | **Meera S.**, manager and HR at Indigo Hub |
| Incognito | Swastik's SAP ID | **Ravi K.**, warehouse operator |
| Another browser or a guest profile | The college SAP ID | **Arjun D.**, manager at Meridian Freight |

Sign everyone in before you go on stage. The bell at the top right of each window shows that person's notifications, and checks every 20 seconds.

## The run (about 8 minutes)

| # | Who | Do | Say |
|---|---|---|---|
| 1 | Front page | Scroll the front page and **How it works** | "The people you need next are already on your floor." |
| 2 | Ravi | Pick English or **हिन्दी**, agree | "Consent first, in his own language." |
| 3 | Ravi | **Record a new skill**: **Talk**, or **Type instead** with the answer below. Confirm the read-back | "SAP's AI turns his words into skills from a real skills library. He checks them before anything is saved." |
| 4 | Ravi | **What we found**, then the **Skills** tab | "EWM shows he really did cycle counting, stock discrepancies and dispatch. It even found putaway, which he never mentioned. Nothing is verified yet: the job match is **0%**." |
| 5 | Ravi | **Requests** or each skill: **Ask my manager to verify** for the 5 role skills: Cycle counting, Stock discrepancy resolution, Dispatch coordination, Inventory system transactions, Digital stock reporting | "He asks. Only a person can verify." |
| 6 | Meera | Bell shows 5. **Verification requests**: verify *Cycle counting*, *Stock discrepancy* and *Dispatch* with **EWM records** | "The proof is the EWM work record. Her name goes on the certificate, and it goes into SuccessFactors." |
| 7 | Ravi | Bell: "Meera verified…". **Jobs**: **80%** | "Only verified skills count. The score is plain code, not AI." |
| 8 | Meera | **EWM daily upload**: choose `docs/ewm-extract-2026-11-03.csv`, **Load into HANA** | "Last night's EWM extract. It shows Ravi's stock transfers." |
| 9 | Meera | **Verification requests**: *Inventory system transactions* now shows 21 tasks in EWM. Verify with **EWM records** | "The upload just backed up what he said." Ravi: **92%**. |
| 10 | Meera | *Digital stock reporting* has no EWM record. Choose **Video of the work**, pick the clip, it plays, **Verify** | "No system records this, so she attaches a short clip. It stays inside the company." Ravi: **100%**. |
| 11 | Ravi | **Certificates**: the certificate. **Resume**: verified skills only | "A real certificate: which manager, which company, how it was proven. His resume lists only what was verified, never what he simply said." |
| 12 | Ravi | **Jobs**: **Ask my manager to review** for Digital Supply Chain Coordinator | "He's ready, and asks for the role." |
| 13 | Meera | **Role reviews**: 100% match, verified skills, evidence, what goes to SuccessFactors. Choose **Move into this role**, **Record decision** | "AI recommends, people decide." |
| 14 | Ravi | Bell: "Congratulations!". His header now says **Digital Supply Chain Coordinator** | "From warehouse operator to coordinator, on proof." |
| 15 | Meera | **My employees** → Ravi: **Watch clip** next to Digital stock reporting. **Find talent**: pick *Cycle counting* | "HR can filter people by verified skill, as in SuccessFactors." |
| 16 | Arjun | Optional, outside hiring: **Hire from outside**, anonymous candidates, **Ask to connect**. Ravi first turns on other companies under **Jobs**, then says yes under **Requests** | "Other companies see skills and a score, no name, until he says yes. His employer never finds out." |
| 17 | Meera | **Audit log**, **Fairness audit**, **SAP landscape** | "Every hand-off is logged. Fairness figures are fictional." |

Keep **People and settings** for Q&A: only registered emails get in, and HR adds or removes people.

**Answer to type or say at step 3** (it covers all five role skills):

- English: `I count the bins every week and fix any stock mismatch with an adjustment. I load the trucks for dispatch, enter goods movements on the scanner, and update the daily stock report on the dashboard.`
- Hindi: `मैं हर हफ्ते बिन की गिनती करता हूँ और स्टॉक के फर्क को एडजस्टमेंट से ठीक करता हूँ। मैं डिस्पैच के लिए ट्रक लोड करता हूँ, स्कैनर पर सिस्टम एंट्री करता हूँ, और डैशबोर्ड पर रोज़ की स्टॉक रिपोर्ट अपडेट करता हूँ।`

If the AI misses a role skill at step 3, record again with just that sentence: Ravi can record more at any time.

## Be accurate about what's live

| Part | On stage |
|---|---|
| App, login and database | Live on SAP BTP with HANA Cloud and XSUAA |
| Voice | Works only in normal Google Chrome, because the built-in browser pane blocks the microphone. Test it there before relying on it. |
| AI | The screens say "AI-assisted" without naming the provider. If asked, say which route is active (`cf logs` shows it): SAP Generative AI Hub (a shared AI Core tenant, with SAP data masking. For Hindi, name masking is off because it mistakes Hindi words for names, while email, phone and ID masking stay on), or the backups: Anthropic API, Google Gemini (not SAP), or the offline fallback. |
| Data | Everything on screen is read live from HANA Cloud. **SAP landscape** shows live counts and says so. On a local test copy it says it isn't HANA. |
| Hiring, roles and certificates | Companies, candidates, jobs and "other certificates" are fictional sample data, but posting, requests, permission and take-back really run and are stored in HANA. |
| EWM | The upload and the HANA records are real. The records themselves are sample data, and no EWM system is connected. |
| SuccessFactors | A local table stands in for it. Say so. If asked: SAP limits the Growth Portfolio API to designated Skills Partners (KBA 3774098), so the real route is partner status or file-based import. |
| Manager's proof | EWM proof is checked against the HANA records. A video clip is really uploaded and stored in HANA. Shift observations and training records store only what the manager types. |
| Companies, people, outside jobs | Fictional |
| Fairness figures | Fictional |

## If something fails

| Problem | Do this |
|---|---|
| Voice fails | Type the answer |
| AI is slow or down | The app uses the next route, or the marked offline backup, and carries on. Say so. |
| Site won't load | Switch to the hotspot, then the backup video |
| HANA stopped | Start it, and use the backup video meanwhile |
| Wrong state mid-demo | Your initials at the top right, **Start over with sample data**, and start again |
| Anything else | Play the backup video without apologising |

## Record the backup video

Record the whole run above from the live URL, with the Agent activity panel open on Ravi's screens. Keep it on the demo laptop.
