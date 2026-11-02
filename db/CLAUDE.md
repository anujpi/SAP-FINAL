# Database

Owner: Vikas. Read the root `CLAUDE.md` first.

`schema.cds` is the source of truth for all 21 tables. CAP creates them on in-memory SQLite locally and on HANA Cloud in production, so don't write database-specific SQL.

## Seed data

`data/frontline-<Entity>.csv`, separated by semicolons. Everything is fictional.

- **Ravi:** ID `00000000-0000-4000-8000-000000000001`, starts at `NOT_STARTED`.
- **Companies and staff:** Indigo Hub Logistics (Meera, Sunil, Ravi and 20 others) and Meridian Freight (Arjun and 3 workers). Cauvery Foods only has a job.
- **The 20 workers at Indigo:** exist so the bias audit has groups to compare and My Employees isn't empty, with matches, decisions, skills and SuccessFactors rows already filled in.
- **EWM records:** the daily extract. Ravi's rows are what give 46 cycle counting tasks in `scripts/journey.js`.
- **Vacancies:** one internal requisition (`source: mock`) and three outside jobs (`source: sample`).
- **Learning modules:** `url` currently points at `https://learning.sap.com`. **Replace these with real course links** before the demo, and don't invent URLs. `M-TRANS` holds the one scripted practice task.

The weights in `RoleSkills` for `DSC-COORD` are what produce Ravi's 68. If you change them, update `scripts/journey.js` and `test/agents.test.js`.

## Rules

- `SkillClaims.status` is `self_reported`, `needs_evidence` or `verified`. There is no "missing".
- `LearningModules.answerKey` must never appear in a worker-facing service.
- `AuditEvents` is append-only. `worker_ID` is a plain value so the trail survives data deletion, and it holds no personal content.
- Avoid HANA reserved words as element names (`level`, `sequence`, `role` as a plain column).
- HDI can overwrite CSV-loaded tables on redeploy. That's fine for this demo. Real business data must never come from CSV.

## Checking HANA

```bash
npx cds compile srv --to sql --dialect hana
```

Run it after schema changes to catch HANA errors before deploying.
