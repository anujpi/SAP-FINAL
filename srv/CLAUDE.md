# Backend (CAP Node.js)

Owner: Anuj. Read the root `CLAUDE.md` first.

## Services

All responses from actions and functions that return `LargeString` are JSON strings, so clients parse them twice.

| Service | Path | Who | Purpose |
|---|---|---|---|
| `WorkerService` | `/worker` | Worker | Own data (`Me`, `MyTasks`, `MySkills`, `MyMatches`, `MyPlan`), catalog, `sendEvent`, `marketSignal` |
| `ManagerService` | `/manager` | All three roles: `ReviewQueue`. Supervisor: `attest`. Manager, HRAdmin: `AuditEvents`, `reviewPacket`. Manager: `decide`. HRAdmin: `fairnessReport`, `resetDemo`. | Review and audit |
| `PassportService` | `/passport` | Worker, plus public `check` | `MyCredentials`, `MyLinks`, `createLink`, `cancelLink`, `check` |

Workers read only their own rows through `@restrict` with `$user.workerId`. In production that attribute must come from XSUAA role-collection attributes (see `xs-security.json`), so assign it per test user in the BTP cockpit.

## Journey

`srv/orchestrator.js` is the single entry point: `handle(workerId, type, payload, actor)`. It checks the stage, runs one handler, updates the stage and writes the audit row.

```
NOT_STARTED -> consent_granted -> DISCOVERING -> input_submitted -> AWAITING_READBACK
AWAITING_READBACK -> input_submitted (redo) | readback_confirmed -> ACTIVE
ACTIVE -> evidence_added | assessment_submitted | module_completed | outside_opt_in (stay ACTIVE)
ACTIVE -> review_requested -> AWAITING_MANAGER
AWAITING_MANAGER -> manager_decided -> ACTIVE (not_yet, request_evidence) | SHORTLISTED (shortlist)
Any stage -> consent_revoked -> HALTED
```

An invalid event returns 409. `sendEvent` accepts only the events in `WORKER_EVENTS`, so a worker can never send `manager_decided` or `evidence_added`.

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
