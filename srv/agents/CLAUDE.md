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
- Agent B may only propose `self_reported` or `needs_evidence`. Only `addEvidence` in the orchestrator can set `verified`.
- Never let the LLM output a score, ranking or verdict about a person, or infer protected attributes.
- `LLM_MODEL` comes from the environment. Don't hardcode it. Pick a model available in your AI Launchpad.

**Not yet tested against real Generative AI Hub.** Locally the agents run on fallbacks. The first real call is today's checkpoint, and you may need to adjust `complete()` in `llm.js` for your account.

## Testing

Add a case in `test/agents.test.js` for any rule change. `npm test` must stay green.

## Bias audit (G)

The seed data is fictional and makes contract workers score lower on purpose, so the flag appears in the demo. Say on stage that it shows how the audit works and isn't a real result. Groups under 3 people are reported but never flagged.
