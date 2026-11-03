# Demo runbook

The exact steps to show Frontline Shift working. Rehearse from this file. All people and data are fictional.

These steps follow app-v2 (branch `app-v2`). Until it's deployed, the live URL still has the older screens: a plain text box instead of **Record a new skill**, and **Learn** instead of **Learning**.

**App:** https://eb72796ftrial-dev-frontline-shift.cfapps.ap21.hana.ondemand.com

## One hour before

1. **Start HANA.** The free tier stops by itself, even within a day, so assume it's stopped. Run `cf update-service frontline-db -c scripts/hana-start.json`, or click **Start** in HANA Cloud Central. Allow up to 20 minutes, and check `frontline-db` shows **Running**.
2. **Start the apps.** The trial stops them too, overnight, and the site then shows `404 Not Found: Requested route`. Log in to `cf`, then run `cf apps`. `frontline-shift` and `frontline-shift-srv` must show `web:1/1`. If not, run `cf start frontline-shift-srv`, then `cf start frontline-shift`.
3. Open the app, sign in, and do the whole run once.
4. Click your initials at the top right, then **Start over with sample data**. A deploy doesn't always reset Ravi, so do this after every deploy too.
5. Keep ready: phone hotspot, charger, projector adapter, the backup video on the laptop.

## Who signs in

Your one SAP login, with the Worker, Manager, Supervisor and HRAdmin role collections, can show everyone. Click your initials at the top right, then under **View as** pick **Ravi K., employee**, **Meera S., manager** or **Arjun D., other company**. Each browser tab remembers its own choice. Say out loud that this is a presenter switch, and that in a customer rollout each person signs in with their own account.

**How it works** is now a section of the public front page (also linked from the home page and the initials menu). It walks through the whole flow, with a "Try it" instruction for each step. Use it to explain, or to find your way if you get lost.

## Tabs to open

Open the app in three tabs, and set each one with **View as**. Duplicating a tab copies its choice, so set it after duplicating.

1. Ravi. The clipboard icon at the top right opens the **Agent activity** panel.
2. Meera.
3. Arjun.
4. HANA Database Explorer, for the live data moment.
5. The slides, then the backup video.

## The run (about 6 minutes)

| # | Who | Do | Say |
|---|---|---|---|
| 1 | Front page | Open the app. Scroll the front page, then click **Sign in with SAP** | "This is what we sell: the people you need next are already on your floor. Real SAP sign-in, and what you see depends on your role and company." |
| 2 | Ravi | Pick **हिन्दी** or English, then agree | "Consent comes first, in the worker's own language." |
| 3 | Ravi | Under **Record a new skill**, tap **Talk** and speak, or **Type instead** and type the answer below. Confirm the read-back. **What we found** lists each skill, with what he said, and its EWM status | "Ravi has never had this written down. SAP's AI matches his words, by meaning, to a real skills library, and he corrects them before anything is saved. Anything it can't match says so. He can record more at any time." |
| 4 | Ravi | **Skills** tab | "We check what he said against what EWM shows he did. These two he never mentioned: the records found them. His manager still decides." Read the cycle counting number off the screen, because each day's upload raises it. |
| 5 | Meera | **EWM Daily Upload**: **Use today's sample**, **Load into HANA** | "Each day the warehouse loads confirmed tasks. This is how we check what he said against real work." |
| 6 | Ravi | **Ask my manager to verify** on *Cycle counting* and *Stock discrepancy resolution* | "He asks. Nothing is verified until a person says so." |
| 7 | Meera | **My Employees**, then click **Ravi K.** to open his profile | "The manager signs in under her company and sees her people. Here's one employee's job record, skills and what EWM shows." |
| 8 | Meera | **Verification Requests**: read the EWM line, keep the proof, **Verify and issue certificate**, twice | "She must give proof. It's mocked today, and her name goes on the result." |
| 9 | Ravi | **Certificates** tab | "A certificate naming the manager and the company." Then show **Resume**. |
| 10 | Ravi | **Jobs** tab, open **How this was worked out** | "68%. This number is plain code, not AI. Only verified skills count." |
| 11 | Ravi | **Learning**: show the steps for one skill (show it at work, learn it, ask your manager). Then under **Lessons and practice**: *Stock transfers*, **Mark as done**, answer `stock transfer`, **Submit**. Back to **Jobs**. | "**80%.** He learned in minutes, proved it, and the score moved live." This is the main moment. |
| 12 | Meera | **Find Talent**: pick *Cycle counting* | "Why a company buys this: verified skills go into SuccessFactors, so HR can filter people for better roles." Say it's a mock store. |
| 13 | Meera | **SAP landscape** (under Company in the menu): click EWM, then SuccessFactors skills. The yellow or green strip shows live counts read from HANA | "It fits around the SAP they already run." Be clear about what's live and what isn't. |
| 14 | Ravi | **Jobs**: turn on other companies | "He chooses to be seen. Companies get his skills and score only, with no name and no employer." |
| 15a | Arjun | **Hire From Outside**: post a role at Hosur. Under **Candidates**, pick **Inventory Controller, Hosur**, and **Ask to connect** on the 80% candidate | "A new role, and anonymous candidates. He doesn't know who this is." |
| 15b | Ravi | **Requests**: tick *Cycle counting*, then **Share and connect** | "This is the permission step. He sees who's asking, and picks exactly what they get." |
| 15c | Arjun | **Outside Applicants**: name and one certificate, shown as genuine. **Invite to interview** with a message | "Only now does he see Ravi's name, and it can be checked." Ravi reads the reply on **Jobs**. |
| 15d | Ravi | Optional: **Requests**, **Take back permission**. Arjun's screens lose his name. | "He can change his mind at any time." Do this last, because Arjun can't reply afterwards. |
| 15e | Meera | **Outside Applicants** and **Audit Log** show nothing about it | "His current employer never finds out." |
| 16 | Ravi | **Certificates**: show *Other certificates on record*. Tick one skill, **Create share link**, **Open link**. Then **Cancel this link** on the new link, and refresh. Leave any other link alone: it belongs to the application in step 15. | "Anyone can check it with no login, and he stays in control." |
| 17 | Meera | **Audit Log**, then **Fairness Audit** | "Every hand-off is logged, and his job search isn't in it. Fairness figures are fictional sample data." |

Keep **People and settings** (Meera) for Q&A: only registered emails get in, HR adds and removes people, and the company switches the job marketplace on or off. Also keep **Ask my manager to review** and **Role Reviews** for Q&A: it's the path for an internal move, where the manager decides and must give a reason for "Not yet".

**Answer to type or say at step 3:**

- English: `I recount the bin, check the last pick list, then raise an adjustment for the discrepancy with my supervisor. I also help with dispatch.`
- Hindi: `मैं बिन की दोबारा गिनती करता हूँ, पिक लिस्ट देखता हूँ, फिर अंतर के लिए सुपरवाइज़र के साथ एडजस्टमेंट करता हूँ। मैं डिस्पैच में भी मदद करता हूँ।`

**Hindi answer at step 11:** `स्टॉक ट्रांसफर`

## Be accurate about what's live

| Part | On stage |
|---|---|
| App, login and database | Live on SAP BTP with HANA Cloud and XSUAA |
| Voice | Works only in normal Google Chrome, because the built-in browser pane blocks the microphone. Test it there before relying on it. |
| AI | The footer and Agent activity show the route. Say which one it is: SAP Generative AI Hub (a shared AI Core tenant, with SAP data masking. For Hindi, name masking is off because it mistakes Hindi words for names, while email, phone and ID masking stay on), or the backups: Anthropic API, Google Gemini (not SAP), or the offline fallback. |
| Data | Everything on screen is read live from HANA Cloud. **SAP landscape** shows live counts and says so. On a local test copy it says it isn't HANA. |
| Hiring, roles and certificates | Companies, candidates, jobs and "other certificates" are fictional sample data, but posting, requests, permission and take-back really run and are stored in HANA. |
| EWM | The upload and the HANA records are real. The records themselves are sample data, and no EWM system is connected. |
| SuccessFactors | A local table stands in for it. Say so. If asked: SAP limits the Growth Portfolio API to designated Skills Partners (KBA 3774098), so the real route is partner status or file-based import. |
| Manager's proof | Mocked: only a type and reference are stored. |
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
