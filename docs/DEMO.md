# Demo runbook

The exact steps to show Frontline Shift working. Rehearse from this file. All people and data are fictional.

**App:** https://eb72796ftrial-dev-frontline-shift.cfapps.ap21.hana.ondemand.com

## One hour before

1. **Start HANA.** The free tier stops by itself, even within a day, so assume it's stopped. Run `cf update-service frontline-db -c scripts/hana-start.json`, or click **Start** in HANA Cloud Central. Allow up to 20 minutes, and check `frontline-db` shows **Running**.
2. **Start the apps.** The trial stops them too, overnight, and the site then shows `404 Not Found: Requested route`. Log in to `cf`, then run `cf apps`. `frontline-shift` and `frontline-shift-srv` must show `web:1/1`. If not, run `cf start frontline-shift-srv`, then `cf start frontline-shift`.
3. Open the app, sign in, and do the whole run once.
4. Click your initials at the top right, then **Reset demo data**. A deploy doesn't always reset Ravi, so do this after every deploy too.
5. Keep ready: phone hotspot, charger, projector adapter, the backup video on the laptop.

## Who signs in

- **Your SAP login**, with the Worker, Manager, Supervisor and HRAdmin role collections, is Meera S. at Indigo Hub Logistics, and also opens Ravi's journey. The home page shows the tiles for every role.
- **A second SAP login** (a teammate's) is needed to show Arjun at Meridian Freight, in an Incognito window. In the cockpit, under Security → Users, give that person the Manager role collection, then map their email and restart:
  ```bash
  cf set-env frontline-shift-srv DEMO_STAFF_MAP "{\"teammate@example.com\":\"arjun\"}"
  ```
  ```bash
  cf restart frontline-shift-srv
  ```
  Without it, skip step 15 and show step 14's public check page instead.

## Tabs to open

1. The app's home page. Open **My Career Journey** for Ravi. The clipboard icon at the top right opens the **Agent activity** panel.
2. The app's home page in a second tab, for Meera.
3. Incognito window, signed in as Arjun.
4. HANA Database Explorer, for the live data moment.
5. The slides, then the backup video.

## The run (about 6 minutes)

| # | Who | Do | Say |
|---|---|---|---|
| 1 | Sign-in | Open the app and click **Sign in with SAP** | "Real SAP sign-in. What you see depends on your role and your company." |
| 2 | Ravi | Pick **हिन्दी** or English, then agree | "Consent comes first, in the worker's own language." |
| 3 | Ravi | Tap **Talk** and speak, or type the answer below, then confirm the read-back | "Ravi has never had this written down. SAP's AI turns his words into tasks, and he corrects them before anything is saved." |
| 4 | Ravi | **Skills** tab | "The AI found these skills. Next to each one: what EWM's records show. 46 confirmed cycle counts." |
| 5 | Meera | **EWM Daily Upload**: **Use today's sample**, **Load into HANA** | "Each day the warehouse loads confirmed tasks. This is how we check what he said against real work." |
| 6 | Ravi | **Ask my manager to verify** on *Cycle counting* and *Stock discrepancy resolution* | "He asks. Nothing is verified until a person says so." |
| 7 | Meera | **My Employees** | "The manager signs in under her company and sees her people and their skills." |
| 8 | Meera | **Verification Requests**: read the EWM line, keep the proof, **Verify and issue certificate**, twice | "She must give proof. It's mocked today, and her name goes on the result." |
| 9 | Ravi | **Certificates** tab | "A certificate naming the manager and the company." Then show **Resume**. |
| 10 | Ravi | **Jobs** tab, open **How this was worked out** | "68%. This number is plain code, not AI. Only verified skills count." |
| 11 | Ravi | **Learn**: *Stock transfers*, **Mark as done**, answer `stock transfer`, **Submit**. Back to **Jobs**. | "**80%.** He learned in minutes, proved it, and the score moved live." This is the main moment. |
| 12 | Meera | **Find Talent**: pick *Cycle counting* | "Why a company buys this: verified skills go into SuccessFactors, so HR can filter people for better roles." Say it's a mock store. |
| 13 | Meera | **SAP Landscape**: click EWM, then SuccessFactors skills | "It fits around the SAP they already run." Be clear about what's live and what isn't. |
| 14 | Ravi | **Jobs**: turn on other companies, **Apply with my certificates** on a Meridian Freight job | "His employer can't see this." |
| 15 | Arjun | **Outside Applicants**: certificates show genuine, **Invite to interview** with a message | "Another company can trust it, because it can check it." Ravi sees the reply on **Jobs**. |
| 16 | Ravi | **Certificates**: tick a skill, **Create share link**, **Open link**. Then **Cancel this link** and refresh. | "Anyone can check it with no login, and he stays in control." |
| 17 | Meera | **Audit Log**, then **Fairness Audit** | "Every hand-off is logged, and his job search isn't in it. Fairness figures are fictional sample data." |

Keep **Ask my manager to review** and **Role Reviews** for Q&A: it's the path for an internal move, where the manager decides and must give a reason for "Not yet".

**Answer to type or say at step 3:**

- English: `I recount the bin, check the last pick list, then raise an adjustment for the discrepancy with my supervisor. I also help with dispatch.`
- Hindi: `मैं बिन की दोबारा गिनती करता हूँ, पिक लिस्ट देखता हूँ, फिर अंतर के लिए सुपरवाइज़र के साथ एडजस्टमेंट करता हूँ। मैं डिस्पैच में भी मदद करता हूँ।`

**Hindi answer at step 11:** `स्टॉक ट्रांसफर`

## Be accurate about what's live

| Part | On stage |
|---|---|
| App, login and database | Live on SAP BTP with HANA Cloud and XSUAA |
| AI | The footer and Agent activity show the route. Say which one it is: SAP Generative AI Hub (a shared AI Core tenant, with SAP data masking), or the backups: Anthropic API, Google Gemini (not SAP), or the offline fallback. |
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
| Wrong state mid-demo | Your initials at the top right, **Reset demo data**, and start again |
| Anything else | Play the backup video without apologising |

## Record the backup video

Record the whole run above from the live URL, with the Agent activity panel open on Ravi's screens. Keep it on the demo laptop.
