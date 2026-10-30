# Worker app

Owner: Swastik. Not built yet. Read the root `CLAUDE.md` first.

Mobile-first React, TypeScript and Tailwind PWA. It talks only to `/worker` and `/passport`, never directly to SAP or the LLM.

## Start

```bash
npm create vite@latest . -- --template react-ts
```

Keep it small. Add a library only when a few lines can't do the job. In development, have Vite proxy `/worker` and `/passport` to `http://localhost:4004` and log in as `ravi` / `ravi`. On BTP, the Approuter handles login.

## Screens

1. **Choose language:** English and Hindi work. Kannada and Tamil are shown but marked "coming soon". Includes consent text, then `consent_granted`.
2. **Talk about work:** voice or typing, then `input_submitted`, then read back `tasks` with Edit, then `readback_confirmed`.
3. **Your skills:** `MySkills`, with chips for Verified, Self-reported and Needs evidence.
4. **Explore a match:** `MyMatches`, with score, why you match, gaps to close and the rule trace, plus `marketSignal`.
5. **Learn on the go:** `MyPlan` and `LearningModules`, with Learning Hub links, `module_completed`, and the practice task through `assessment_submitted`.
6. **Skill Passport:** pick verified skills, `createLink`, show a QR code and `cancelLink`.

## Calling the backend

```
POST /worker/sendEvent   { "type": "input_submitted", "payload": "{\"text\":\"...\"}" }
```

`payload` is a JSON string, and the response is a JSON string in `value`. See `scripts/journey.js` for every call in order. `Me.stage` tells you which screen to show, so don't keep hidden journey state in the browser.

## Voice

Use the browser's Web Speech API (`hi-IN`, `en-IN`), and show a typed fallback one tap away. Chrome sends speech audio to Google, so say so in the consent text. Raw audio never reaches our backend. Mic access needs HTTPS or localhost, so test on the deployed URL.

## Rules

- Never render the word "Missing". Use "Needs evidence".
- If a response has `degraded: true`, show a small notice.
- Show a sample-data badge, and a footer saying "No live SAP system is connected".
- Tap targets 48px or larger, type 16px or larger, icons with labels, short sentences.
- Unverified skills must never read as a negative.
- Disable buttons while a call runs, since the backend has no double-submit protection.
- Don't keep tokens in `localStorage`.
