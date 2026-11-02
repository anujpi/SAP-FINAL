# Frontline Shift: Full Plan

From today to the finale, then from the finale to a real product.
Written Fri 30 Oct 2026. Tick boxes as you go. Costs and prices are planning estimates, not quotes.

**Updated Mon 2 Nov.** The product flow changed, and it overrides anything older below. See "The product" in the root `CLAUDE.md` and the run in `docs/DEMO.md`: spoken work → AI skills → EWM check → manager verifies with proof → certificate and resume naming the manager and company → apply to other companies → skills in SuccessFactors, so HR can filter by skill. The app now uses SAP Generative AI Hub, not the Anthropic backup described in section 1.

## 1. Where things stand

| Area | Status |
|---|---|
| Backend, seven agents, Skill Passport, seed data | Built. Unit tests and Ravi's journey pass locally. |
| LLM | SAP AI Core isn't offered on this trial. The direct Anthropic backup is written and tested against a stand-in, but needs a real key. Agents A and B run on marked fallbacks until then. |
| HANA Cloud, XSUAA, BTP deployment | Deployed. Public routes tested. Logged-in screens not yet tested on BTP. |
| Worker app, manager app, public check page | Built in `app/web`. The full journey works in the browser locally, in English and Hindi. |
| Stakeholder validation | Team decision: no interviews. Use published reports and say so. |
| Demo runbook | `docs/DEMO.md`. Slides and Signavio models not started. |

## 2. How the jury scores you

From the participant guide. Build and rehearse against this table.

| Area | What they ask | Your answer | Status |
|---|---|---|---|
| **Problem** | Specificity: precisely scoped? | Warehouse operators moving into a Digital Supply Chain Coordinator role, at SAP-using sites | Ready |
| | Root cause: why does it exist? | Skills are learned on the floor and never recorded. Career systems trust CVs and credentials, and employers find external hiring easier to see. | Ready |
| | Stakeholder validation: evidence, not assumptions? | OECD, ILO and ETF reports. No interviews were done, so say that plainly if asked. | Section 4 |
| **Systems thinking** | Process links: upstream and downstream mapped? | Signavio models, plus SuccessFactors, EWM and Learning connections | Models to draw |
| | Second-order consequences? | Section 7 | Ready |
| | Change management? | Section 8 | Ready |
| **Business viability** | Value proposition: specific ROI for the buyer? | Fill roles internally instead of paying for external hiring and ramp-up. Needs one worked example. | Section 9 |
| | Revenue model? | Employer pays per enrolled worker plus a site setup fee. Workers pay nothing. | Ready |
| | Go-to-market? | SAP Store listing, SAP partner co-selling, one pilot site first | Ready |
| **Demo & feasibility** | Prototype proves the core value, function over flash? | Evidence changes the score live, and a person makes the decision | To build |
| | Resources: timeline, skills, overall cost? | Section 10 | Ready |
| | Presentation and teamwork? | **All five present, and each speaks.** Keep to time, since overruns are penalised. | To rehearse |

## 3. Finale build plan

Work in this order. Each day ends with a check. If a check fails, fix it before starting anything new.

### Fri 30 Oct (tonight): prove SAP works

Everything else depends on this.

- [ ] Run `npm run watch`, then `npm run journey` in a second terminal. It must pass.
- [ ] Commit and push the current code.
- [x] Create the BTP trial account at `account.hanatrial.ondemand.com`. Region: Singapore (Azure). API endpoint: `https://api.cf.ap21.hana.ondemand.com`. Use Chrome for the cockpit, because entitlements returned 403 errors in the Claude app's built-in browser.
- [x] Open the trial subaccount, then check Entitlements. `hana-cloud`, `hana-cloud-tools` and `hana` (`hdi-shared`) are there. **SAP AI Core isn't offered on this account**, so follow steps 2 and 3 of the LLM decision below. `xsuaa` and Cloud Foundry `MEMORY` aren't confirmed yet.
- [x] Create a HANA Cloud instance: `frontline-db`, free tier, Cloud Foundry `dev` space, Cloud Foundry IP addresses only.
- [x] Install the tools: `cf` CLI, `multiapps` plugin, `mbt` and GNU Make.
- [x] Run `cf login`, `mbt build`, then `cf deploy mta_archives/frontline-shift_1.0.0.mtar`. Live at https://eb72796ftrial-dev-frontline-shift.cfapps.ap21.hana.ondemand.com
- [x] Set the secret with `cf set-env frontline-shift-srv PASSPORT_SECRET <long random value>`, then restart the app.
- [ ] **Generative AI Hub:** follow the decision below, and set `LLM_MODEL`.

**LLM decision.** Generative AI Hub needs the AI Core `extended` plan, and I couldn't confirm a normal trial account offers it.

1. If `extended` appears in your entitlements, run the AI Core booster, create a service key, create the orchestration deployment and bind it to the app.
2. If not, register for SAP's separate 30-day Generative AI Hub trial and see whether it gives you a service key your app can use. It may only give you a login and a workbook.
3. If neither works by noon on Sat 31 Oct, use the direct backup already in `srv/lib/llm.js`: set `ANTHROPIC_API_KEY` in `.env` locally and with `cf set-env` on BTP. **Say so on the live vs. mocked slide**, and show the Generative AI Hub trial in AI Launchpad separately. The direct route hides emails and phone numbers but not names, so a real deployment must use the Hub.

**Check:** the deployed URL opens on a phone and asks for login, the journey data sits in HANA, and one real LLM reply comes back.

### Sat 31 Oct: worker app and validation

- [x] Set up the React app in `app/web` (one app, plain CSS).
- [x] Screen 1: language and consent.
- [x] Screen 2: voice or typing, then read-back with edit. Voice not yet tried on a real phone.
- [x] Screen 3: skills with status chips.
- [x] Screen 4: match with strengths, gaps, rule trace and market signal.
- [x] Hindi and English text for those screens. Skill names are still English.
- [ ] Tune agent A and B prompts on real answers in English and Hindi, including short answers, mixed language and an attempt to inject instructions.
- [ ] Draw the two Signavio models if access works (about 2 hours).

**Check:** Ravi speaks in Hindi on a real phone and sees a correct read-back and skills profile.

### Sun 1 Nov: the rest of the journey

- [x] Screen 5: pathway and the practice task. Learning Hub links still need replacing.
- [x] Screen 6: Skill Passport with QR code and cancel.
- [x] Manager screens: review queue, review packet, decision, attestation.
- [x] Audit log, fairness view and "Reset demo".
- [x] Public check page with no login.
- [x] **System trace panel:** shows each hand-off and the active AI route live.
- [ ] Replace placeholder `learning.sap.com` links in the seed with real course pages.
- [ ] Take at least one Learning Hub course each, and screenshot completion.

**Check:** the whole journey works in the browser locally, with every screen backed by the real API.

### Mon 2 Nov: deploy and rehearse

- [ ] Wire the frontends into BTP (section 5) and deploy everything.
- [ ] Try one live call to the SAP Business Accelerator Hub sandbox. Add it only if it takes under 2 hours. Save the last good response and label it "cached" if used.
- [ ] Run the full demo on the deployed URL **three times without a failure**.
- [ ] Record the backup video from the deployed URL.
- [ ] Build the slides (section 6).
- [ ] Only if everything above is done: an SAP Analytics Cloud story.

**Check:** three clean runs, and the video is saved on the demo laptop.

### Tue 3 Nov: freeze

- [ ] Code freeze. Fix blockers only.
- [ ] Rehearse twice with a timer: 10 minutes, then 5 minutes of Q&A with hard questions.
- [ ] Every member can answer questions on their section.
- [ ] Test the demo on the venue-style setup: projector, adapter, phone hotspot.

### Wed 4 Nov: finale

- [ ] Restart the HANA trial instance in the morning and run the journey once. (Nightly stop is from my memory of how trials work, so check your instance.)
- [ ] Press "Reset demo".
- [ ] Open the tabs: worker app, manager app, HANA Database Explorer, BTP cockpit, slides, backup video.
- [ ] Laptop charged, adapter packed, hotspot ready, all five members present.

### If you fall behind, cut in this order

1. SAP Analytics Cloud, Document AI, Process Intelligence, sandbox call
2. Market signal display (agent F stays in the backend)
3. Fairness screen (show one flagged figure on a slide)
4. Signavio models (draw them in any tool, and don't call them Signavio)
5. Hindi UI text (keep Hindi voice)
6. XSUAA (mocked users with a role switcher, only because all data is fictional)

**Never cut:** voice or text to read-back, verified vs. self-reported, the 68 match with its rule trace, the practice task raising the score, the manager decision with its reason, the audit log.

## 4. Evidence for the problem

The team chose not to run interviews before the finale. Use the published research from the selection deck: OECD (2026) on skills-first hiring, ILO (2026) on recognition of prior learning, and ETF and partners (2026) on AI and skills.

Ravi is a fictional composite, so say that. Don't imply anyone was interviewed, and never invent quotes. If the jury asks about validation, say: "We used published research for this round. Interviews are the first step of the pilot."

Expect a lower score on this one criterion.

## 5. Deployment work still to do

Done: frontends build into `.deploy/app-router/resources` and deploy with the Approuter, and only `/passport/check(...)`, `check.html` and `/assets` are public. The CSRF token handling in `app/web/src/api.ts` is written but not yet tested on BTP. For current status, see `docs/HANDOFF.md`.

- **Worker login:** assign role collections and the `workerId` attribute to your test user in the BTP cockpit. `$user.workerId` must come from there.
- **AI Core:** add the binding to `mta.yaml`, and set `LLM_MODEL`.
- **Secret:** set `PASSPORT_SECRET`, or passport signing refuses to work in production.

## 6. The 10-minute presentation

| Time | Section | Content | Speaker |
|---|---|---|---|
| 0:00–1:15 | Problem | Ravi's story, root cause, what real people told you | Member 1 |
| 1:15–6:15 | **Live demo** | See below | Members 2–3 |
| 6:15–7:15 | Systems | Signavio before and after, consequences, change plan | Member 4 |
| 7:15–8:15 | Feasibility | Live vs. mocked, timeline, skills, cost | Member 5 |
| 8:15–9:30 | Business | Buyer ROI, revenue, go-to-market | Member 1 |
| 9:30–10:00 | Close | The one line and the ask | All |

Finish at 9:45 if you can, since going over is penalised.

### Demo script

Split screen: worker app in phone view on the left, SAP trace panel on the right.

1. **Consent and language (30s):** Ravi picks Hindi and agrees.
2. **Talk (60s):** he speaks about stock discrepancies, then corrects one word in the read-back. The trace shows Generative AI Hub and masking.
3. **Skills (45s):** self-reported skills appear. **Switch to HANA Database Explorer and run a `SELECT` to show his row.**
4. **Evidence and match (60s):** the supervisor attests two skills, and the score becomes 68 with the rule trace. "This number is code, not AI."
5. **Upskill (45s):** he sees Learning Hub links and passes the practice task. **The score rises to 80 live.** This is the core value moment.
6. **Manager (30s):** "Not yet" with a reason, then the audit log shows every hand-off.
7. **Skill Passport (30s):** QR code, public check says "Genuine", cancel, then it says "Cancelled".

If voice fails, type. If anything else fails, switch to the video without apologising.

### Slides

1. Title and team
2. Problem: Ravi, root cause, real evidence
3. Solution: one journey, seven agents, humans decide
4. (Live demo)
5. Architecture: nine layers on SAP BTP
6. Live vs. mocked, table below
7. Before and after processes in Signavio
8. Second-order consequences and change management
9. Timeline, skills, cost
10. Buyer ROI and revenue
11. Go-to-market and roadmap
12. What we learned on Learning Hub

| Component | Status on stage |
|---|---|
| BTP, CAP, HANA Cloud, XSUAA | Live, if deployed |
| Generative AI Hub | Live, or say the app uses the direct Anthropic backup and show the Hub separately |
| SAP API call | Sandbox with SAP's sample data, if built |
| Ravi's HR and warehouse records, outside jobs | Mocked or sample, in SAP's format |
| Fairness figures | Fictional |
| Real customer connection | Next phase |

### Hard questions

| Question | Answer |
|---|---|
| Is this connected to real SuccessFactors? | No, we have no customer system. Data is mocked in SAP's format, and connecting is a configuration and integration step in the next phase. |
| SAP already has Opportunity Marketplace. Why you? | We feed it. We add voice-first capture and evidence for people those systems can't see, and write back only approved skills. |
| What if the AI is wrong? | It proposes, the worker corrects, and evidence verifies. The score ignores anything unverified, and a person decides. |
| Why would an employer pay for a passport that helps people leave? | They pay for internal mobility. The passport is free for workers, and people stay because they have a path up. |
| Is this high-risk under the EU AI Act? | Used for promotion decisions, likely yes, so human oversight and audit are built in. In India, the DPDP Act shapes consent and deletion. |
| What about workers with no smartphone? | A shared break-room tablet with employee-ID login. |
| How do you know it works? | We don't yet. These are pilot hypotheses, and here is what the pilot measures. |

## 7. Second-order consequences

| Consequence | Handling |
|---|---|
| Good operators move up, leaving floor gaps | Show managers the backfill pipeline. Time moves with the site. |
| Used as surveillance or for layoffs | Written policy: never for appraisal, discipline or layoffs. Workers can see and delete their data. |
| Supervisor overload | Weekly batch of about 2 minutes per worker |
| Favouritism in attestations | Cross-check with EWM records and the bias audit |
| Biased speech or LLM results by accent or language | Test per language, keep read-back, and audit outcomes by group |
| More verified people than open roles, leading to frustration | Show realistic "not yet" reasons, and the passport keeps skills useful elsewhere |
| Poaching through the passport | Worker-controlled and shares proven skills only. Measure retention in the pilot. |
| Contract workers left out | Register them separately, with the agency's agreement |
| Paper evidence faked | Link to the S/4HANA inventory document, with supervisor confirmation |

## 8. Change management

| When | What |
|---|---|
| Before launch | Agree paid learning time and the written data policy. HR defines required skills per role. Consult the union or works council if there is one. |
| Launch | 5-minute talk at shift briefing, QR poster in the break room, a shared tablet, volunteers only |
| First month | Each site has a champion. Supervisors get a 30-minute briefing. Weekly check-in. |
| Resistance | Workers: privacy promise and visible career paths. Supervisors: minimal time and credit for developing staff. Managers: the decision stays theirs. HR: it feeds SuccessFactors rather than replacing it. |
| Measure | Discovery completion, verified-skill share, learning completion, internal moves, retention, gaps between groups |

## 9. Business case

**Who pays:** employers with large frontline teams on SAP: warehouses, logistics firms, manufacturers and retail distribution centres. Workers never pay, and worker data is never sold.

| Revenue | Hypothesis |
|---|---|
| Subscription | ₹150–300 per enrolled worker per month |
| Site setup | ₹5–15 lakh one-time |
| Success fee (optional) | ₹10–20k per internal move |
| Hiring companies, later | Fee per verified external hire through the passport |

**Example:** a customer with 2,000 frontline workers and 20% enrolled pays 400 × ₹200 × 12 = ₹9.6 lakh a year, plus ₹10 lakh setup in year 1. With about ₹1.2 crore a year in fixed costs and about ₹3 lakh a year per customer, break-even is about 18 customers.

**Buyer ROI (to fill in):** cost of one external hire (agency fee, recruiter time, ramp-up) × internal moves per year, compared with the subscription. Research a real agency fee and cite it, because I have no verified figure. Present it as a hypothesis the pilot measures.

**Go-to-market:**
1. One pilot with a logistics firm already on SAP, free or at cost, in exchange for measured results.
2. Use that case study to approach similar firms.
3. Join SAP's partner programme and list on SAP Store, so SAP's sales team can sell it to existing customers.
4. Sell through implementation partners who already run SuccessFactors projects.

**Market size (to fill in):** count the SAP SuccessFactors and EWM customers in India with large frontline teams. The guide's $5.5T global skills gap is context, not your market.

## 10. Resources (timeline, skills, cost)

| Phase | Time | Gate to continue | Estimated cost |
|---|---|---|---|
| 1. Prototype | Until 4 Nov | Jury and mentor review | About ₹0, on trials |
| 2. Controlled pilot | About 6 months | Targets agreed before start | ₹1.0–1.5 crore |
| 3. Enterprise integration | About 6 months | Security and privacy review | ₹1.3–1.8 crore |
| 4. Scale | Ongoing | Pilot hypotheses supported | ₹70 lakh–1.05 crore a year at 500 workers |

**Pilot team:** product manager, 2 CAP and React developers, AI engineer, UX designer, QA, part-time SAP integration consultant and part-time compliance lead.

**Pilot budget:** team ₹70–90 lakh, SAP cloud ₹6–12 lakh (placeholder, price it in the SAP BTP estimator), AI usage ₹1–3 lakh, legal and fairness audit ₹8–15 lakh, content and pilot support ₹5–10 lakh, contingency 15%.

**Known SAP prices:** Integration Suite Starter is listed at €1,500 per tenant per month on SAP's German page. Opportunity Marketplace is £2 per user per month on a UK public-sector price sheet. SAP's per-user AI agents could outgrow every other cost, so get a written quote.

## 11. After the finale: bringing it to life

### Next 2 weeks
- [ ] Record what the jury said.
- [ ] Follow up with SAP contacts and mentors, and ask about partner or startup programmes.
- [ ] Clean the repo, and note what was mocked.
- [ ] Decide who stays on the project, and how, given college.
- [ ] Certification: use the student pack's two exam attempts.

### Months 1–3: get a pilot partner
- [ ] Do 10–15 proper interviews with workers, supervisors and HR.
- [ ] Get a pilot partner on SAP, with a letter of intent.
- [ ] Register a company or find an academic or incubator home, and take legal advice.
- [ ] Apply for funding: incubators, startup programmes, skilling grants. Pilots need ₹1 crore or more, or a much smaller, partner-funded scope.

### Months 3–9: controlled pilot at one site
- [ ] 50–500 consenting volunteers, baseline metrics agreed first.
- [ ] Privacy impact assessment, written data policy, DPDP Act review.
- [ ] Build what the prototype skipped: offline sync, real assessments, proper login for workers with no company email, governed speech service, Kannada and Tamil with measured accuracy, idempotency and rate limits.
- [ ] Publish real results, including what failed.

### Months 9–18: enterprise integration
- [ ] Live SuccessFactors and EWM through Integration Suite, Destination and Cloud Connector.
- [ ] Write approved skills back to SuccessFactors.
- [ ] Security testing and an independent fairness audit.
- [ ] SAP Document AI for paper records, and Signavio Process Intelligence on real audit data.
- [ ] SAP Store listing.

### Month 18 onward: scale
- [ ] More roles, sites, languages and customers.
- [ ] Skill Passport linked to national skilling schemes and DigiLocker, if research supports it.
- [ ] External hiring revenue.

## 12. Top risks

| Risk | Likelihood | Response |
|---|---|---|
| AI Core `extended` plan unavailable on trial | Medium | LLM decision in section 3 |
| BTP setup eats a full day | High | Started tonight. Follow SAP's CAP deployment tutorial. |
| Live voice fails in a noisy hall | Medium | Typed fallback, then video |
| HANA instance stopped on the morning | Medium | Morning checklist |
| Venue network fails | Medium | Hotspot and video |
| Jury questions the lack of interviews | High | Answer plainly, using section 4 |
| Running out of time | High | Cut order in section 3 |

## 13. Things still to confirm

- Whether your BTP trial offers AI Core `extended` and which models it has.
- Whether Joule Studio is available to you. It isn't in this plan either way.
- Which Signavio tools your academic or trial account includes.
- Your practice-system hours in the student pack.
- Which Business Accelerator Hub APIs have working sandboxes.
- All prices, through the SAP BTP estimator and a written SAP quote.
