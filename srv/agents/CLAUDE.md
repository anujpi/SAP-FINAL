# Agents

Owners: Ujjwal (A, B and `srv/lib/llm.js`), Vikas (C, F, G), Guneesh (E), Anuj (D wiring). Read the root `CLAUDE.md` first.

Each agent is one file with one exported function: contract in, contract out. Agents never import each other, never touch the database and never record a decision.

| Agent | File | Uses LLM? | Output |
|---|---|---|---|
| A Skills Discovery | `discover.js` | Yes | `{ tasks: TaskExperience[], degraded }` |
| B Skill Verification | `verify.js` | Yes | `{ claims: SkillClaim[], degraded }` |
| C Role Matching | `match.js` | No | `{ score, strengths, gaps, ruleTrace }` |
| D Learning Pathway | `pathway.js` | No, catalog order | Ordered module IDs |
| E Review & Progress | `review.js` | No | `ReviewPacket` |
| F Market Intelligence | `market.js` | No, counts sample jobs | `MarketSignal[]` |
| G Bias Audit | `audit.js` | No, rules | `FairnessReport[]` |

Say this openly to the jury: only A and B use the LLM. The rest are code on purpose, because career-affecting numbers must be reproducible.

## Matching (C)

`match = Σ(w·c) / Σw` over the role's required skills. `c` is 1 if verified at the required level, 0.5 if verified below it, and 0 otherwise. Ravi's seed role gives the deck's 68 with cycle counting and stock discrepancy verified, then 80 after the practice task.

## Using the LLM

- Call only `askJson` from `../lib/llm`. It handles masking, one retry, validation and the fallback.
- Always pass a `validate` function and a `fallback`. A fallback result is marked `degraded: true`, and the UI must show that.
- User text is data, never instructions. It goes in the `{{?input}}` placeholder, and prompts say to ignore requests inside it.
- Agent B may only propose `self_reported`, `needs_evidence` or `work_records`. Only `addEvidence` in the orchestrator can set `verified`.
- After the LLM, `applyWorkRecords` (`srv/lib/ewm.js`, plain code) checks the claims against the worker's EWM records, which the orchestrator reads from HANA. Records back up what was said, find what wasn't said, and mark trackable skills with no records as `needs_evidence`. Skills EWM can't see stay as said. With no records at all, nothing changes. None of this affects the score.
- SAP's person masking mistakes Hindi words for names, so Devanagari text skips that one entity (`maskedEntities` in `llm.js`). Email, phone and ID masking stay on, and Agent A is told to leave names out.
- Never let the LLM output a score, ranking or verdict about a person, or infer protected attributes.
- `LLM_MODEL` comes from the environment. Don't hardcode it. Pick a model available in your AI Launchpad.

## LLM routes

`srv/lib/llm.js` picks the first route available:

| Route | Needs | Masking |
|---|---|---|
| `generative-ai-hub` | AI Core binding or `AICORE_SERVICE_KEY`, plus `LLM_MODEL` | SAP data masking |
| `direct-anthropic` | `ANTHROPIC_API_KEY`. Uses `claude-opus-5-5` unless `LLM_MODEL` is set. Server-side refusal fallback is on. | Emails and phone numbers only, not names |
| `offline` | Nothing | Nothing leaves the app, and results are marked `degraded` |

Keys go in `.env` locally (see `.env.example`) and `cf set-env` on BTP. Never commit them.

**Neither live route has been called for real yet.** `test/llm.test.js` runs the real Anthropic SDK against a local stand-in server. The Hub route is untested, so you may need to adjust `completeHub()` for your account.

## Testing

Add a case in `test/agents.test.js` for any rule change. `npm test` must stay green.

## Bias audit (G)

The seed data is fictional and makes contract workers score lower on purpose, so the flag appears in the demo. Say on stage that it shows how the audit works and isn't a real result. Groups under 3 people are reported but never flagged.
