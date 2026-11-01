# Demo runbook

The exact steps to show Frontline Shift working. Rehearse from this file. All people and data are fictional.

**App:** https://eb72796ftrial-dev-frontline-shift.cfapps.ap21.hana.ondemand.com

## One hour before

1. **Start HANA.** The free tier stops by itself, even within a day, so assume it's stopped. Run `cf update-service frontline-db -c scripts/hana-start.json`, or click **Start** in HANA Cloud Central. Allow up to 20 minutes, and check `frontline-db` shows **Running**.
2. Log in to `cf`, then run `cf apps`. `frontline-shift` and `frontline-shift-srv` must show `web:1/1`. If not, run `cf restart frontline-shift-srv`.
3. Open the app, sign in, and do the whole run once.
4. Open `/#/manager`, choose **Attest skills**, and click **Reset demo for this worker**.
5. Keep ready: phone hotspot, charger, projector adapter, the backup video on the laptop.

## Tabs to open

1. The app, on the worker view (phone-sized on the left, system trace on the right).
2. The app with `#/manager` added.
3. HANA Database Explorer, for the live data moment.
4. The slides.
5. The backup video.

## The run (about 5 minutes)

| # | Screen | Do | Say |
|---|---|---|---|
| 1 | Worker | Pick **हिन्दी** or English, tap agree | "Consent comes first, in the worker's own language." |
| 2 | Worker | Tap **Talk** and speak, or type the answer below | "Ravi has never had this skill written down." |
| 3 | Worker | Check the read-back, then confirm | "He corrects it before anything is saved." Point at the trace. |
| 4 | Worker | **Skills** tab | "These are only self-reported, so they score nothing yet." |
| 5 | Manager | **Attest skills**: Ravi, *Cycle counting*, attest. Then *Stock discrepancy resolution*, attest. | "A supervisor confirms what they've seen." |
| 6 | Worker | **Match** tab, open **How this was worked out** | "68%. This number is plain code, not AI. Every step is visible." |
| 7 | Worker | **Learn** tab: *Stock transfers*, **Mark as done**. Answer `stock transfer`, **Submit**. | "He learns in minutes and proves it." |
| 8 | Worker | **Match** tab | "**80%.** Evidence changed the score, live." This is the main moment. |
| 9 | Worker | **Ask my manager to review** | |
| 10 | Manager | **Review**: read the packet, pick **Not yet**, give a reason, record it | "The manager decides, not the AI, and must give a reason." |
| 11 | Worker | See the reason at the top | "Not yet is never a dead end." |
| 12 | Manager | **Audit log**, then **Fairness** | "Every hand-off is logged. Fairness figures are fictional sample data." |
| 13 | Worker | **Passport**: tick skills, **Create share link** | "Proven skills belong to Ravi." |
| 14 | Check | **Open link**: shows "Genuine, not altered" with no login | "An outside employer can verify it." |
| 15 | Worker | **Cancel this link**, then refresh the check page: "Cancelled" | "He stays in control." |

**Answer to type or say at step 2:**

- English: `I recount the bin, check the last pick list, then raise an adjustment for the discrepancy with my supervisor. I also help with dispatch.`
- Hindi: `मैं बिन की दोबारा गिनती करता हूँ, पिक लिस्ट देखता हूँ, फिर अंतर के लिए सुपरवाइज़र के साथ एडजस्टमेंट करता हूँ। मैं डिस्पैच में भी मदद करता हूँ।`

**Hindi answer at step 7:** `स्टॉक ट्रांसफर`

## Be accurate about what's live

| Part | On stage |
|---|---|
| App, login and database | Live on SAP BTP with HANA Cloud and XSUAA |
| AI | The trace shows the route. Say which one it is: Anthropic API, or the offline backup. SAP AI Core isn't on this trial. |
| SuccessFactors, EWM and outside jobs | Mock data. Say so. |
| Fairness figures | Fictional |

## If something fails

| Problem | Do this |
|---|---|
| Voice fails | Type the answer |
| AI is slow or down | The app uses the marked backup and carries on. Say so. |
| Site won't load | Switch to the hotspot, then the backup video |
| HANA stopped | Start it, and use the backup video meanwhile |
| Wrong state mid-demo | **Reset demo for this worker**, and start again |
| Anything else | Play the backup video without apologising |

## Record the backup video

Record the whole run above from the live URL, with the system trace visible. Keep it on the demo laptop.
