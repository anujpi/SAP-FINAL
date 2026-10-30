# Manager app and public check page

Owner: Guneesh. Not built yet. Read the root `CLAUDE.md` first.

React, TypeScript and Tailwind. It talks only to `/manager` and `/passport`. Log in locally as `meera` / `meera`.

## Manager screens

1. **Review queue:** `ReviewQueue`.
2. **Review packet:** `reviewPacket(worker=<id>)`, showing evidence, verified skills, skills needing evidence, match and rule trace.
3. **Decision:** `decide` with Shortlist, Request more evidence or Not yet. A reason is required for the last two. Show: "Decision and reason are logged. The manager decides, not the AI."
4. **Supervisor attestation:** `attest` with skill and proficiency 1–3, as a short weekly list.
5. **Audit log:** `AuditEvents` as a hand-off timeline. This proves the multi-agent claim on stage.
6. **Fairness:** `fairnessReport()`, labelled "Fictional sample data".
7. **Reset demo:** `resetDemo` with Ravi's ID, so the live demo starts on the first screen.

## Public check page

Opens with no login from Ravi's QR link and calls `/passport/check(token='<token>')`.

| Status | Show |
|---|---|
| `genuine` | "Genuine, not altered", with worker name and shared skills |
| `cancelled` | "Cancelled by the worker" |
| `altered` | "Could not be verified" |
| `unknown` | "Link not found" |

Show nothing beyond what the response contains. The Approuter needs a route with `"authenticationType": "none"` for `/passport/check` and this page, and every other route stays authenticated.

## Rules

- Unverified skills must never read as negative. Never render "Missing".
- The manager sees scores as illustrative demo data, not results.
- `/passport` only exposes the `check` function publicly, so don't add other public routes.

## Pitch and video (also yours)

- Keep the "live vs. mocked" slide accurate. Show it yourself before anyone asks.
- Record the backup video from the deployed URL on 2 Nov, and keep it on the demo laptop.
- Draw the two Signavio process models only after the app work is on track.
