# Backend (CAP Node.js)

Owner: Anuj. Read the root `CLAUDE.md` first.

## Services

All responses from actions and functions that return `LargeString` are JSON strings, so clients parse them twice.

| Service | Path | Who | Purpose |
|---|---|---|---|
| `UserService` | `/user` | Anyone signed in | `me()`: name, title, company, roles |
| `WorkerService` | `/worker` | Worker | Own data (`Me`, `MyTasks`, `MySkills`, `MyMatches`, `MyPlan`, `MyRequests`, `MyApplications`), catalog, `sendEvent`, `marketSignal`, `myEwmSupport` |
| `ManagerService` | `/manager` | Limited to the caller's company (`staffOf`). See the `@requires` in `manager-service.cds`. | Employees, verification with proof, EWM upload, find talent, outside applicants, role reviews, audit, fairness |
| `PassportService` | `/passport` | Worker, plus public `check` | `MyCredentials`, `MyLinks`, `createLink`, `cancelLink`, `check` |

Workers read only their own rows through `@restrict` with `$user.workerId`. A manager's company comes from the `Staff` table. On BTP, logins are email addresses, so `DEMO_STAFF_MAP` maps them to a `Staff` row, and with `DEMO_WORKER_ID` set any other login is Meera (`srv/lib/demo-worker.js`).

A worker's outside job search is private from their employer: those events stay out of `AuditEvents` in `ManagerService`, and `applicants()` shows only applications to the caller's own vacancies.

`addEvidence` in the orchestrator is the one place a skill becomes verified. It signs the certificate and writes to `SuccessFactorsSkills`, a local stand-in. Swap that one step for a Destination call when a tenant exists.

## Journey

`srv/orchestrator.js` is the single entry point: `handle(workerId, type, payload, actor)`. It checks the stage, runs one handler, updates the stage and writes the audit row.

```
NOT_STARTED -> consent_granted -> DISCOVERING -> input_submitted -> AWAITING_READBACK
AWAITING_READBACK -> input_submitted (redo) | readback_confirmed -> ACTIVE
ACTIVE -> assessment_submitted | module_completed (stay ACTIVE)
ACTIVE -> review_requested -> AWAITING_MANAGER
AWAITING_MANAGER -> manager_decided -> ACTIVE (not_yet, request_evidence) | SHORTLISTED (shortlist)
ACTIVE, AWAITING_MANAGER, SHORTLISTED -> verification_requested | verification_decided | outside_opt_in | application_submitted | application_answered (stay put)
Any stage -> consent_revoked -> HALTED
```

An invalid event returns 409. `sendEvent` accepts only the events in `WORKER_EVENTS`, so a worker can never send `manager_decided`, `verification_decided` or `application_answered`.

## Adding an event

1. Add it to `TRANSITIONS`, and to `WORKER_EVENTS` only if a worker may send it.
2. Add a handler in `HANDLERS` that returns `{ contract, degraded?, stage?, ...result }`.
3. Add a step to `scripts/journey.js`.

## Rules

- Only the orchestrator runs agents or changes `stage`. Services stay thin.
- Handlers read and write the database. Agents don't.
- Run `refresh()` after anything that changes evidence, so match and plan stay current.
- Treat user text as untrusted. Check input size and allowed values at the service boundary.
- `PASSPORT_SECRET` must be set in production. The service refuses to sign without it.
- The public `check` function must return only what the worker chose to share.

## Known ceilings

- No idempotency keys or optimistic locking. A double-tap can repeat an event, so disable buttons while a call runs.
- `check` has no rate limit. Tokens are 32 random bytes, which is fine for the demo; add a limit in production.
- Mock SAP data sits in the local `Vacancies` and `RoleSkills` tables. To show SAP's API live, add one server-side call to the Business Accelerator Hub sandbox. The API key stays on the server.
