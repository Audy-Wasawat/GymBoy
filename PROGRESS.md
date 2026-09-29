# Autopilot progress

Kept current so a compacted or restarted session can resume. See AUTOPILOT.md for the plan.

## Status
- **Current phase:** 4 (Running)
- **Current step:** implementation done; `npm run build`, `npm test` and `npm run test:tz` all pass. Five review subagents running (spec, data-integrity, qa-flow, offline, mobile-ux). Awaiting findings to fix, then commit.
- **Last passing build:** Phase 4 working tree — build + tests green (27 tests, 4 zones).
- **Next:** triage subagent findings, fix HIGH/MEDIUM, re-run, commit "Phase 4: Running".

## Dev/preview servers
- A Vite dev server was started on http://localhost:5173 for the qa/mobile agents (HashRouter). Remember to stop it (`npm run dev` background task) before finishing the run.

## Test setup (done)
- devDeps added: `vitest`, `fake-indexeddb`.
- `npm test` runs the vitest suite once; `npm run test:tz` runs it under the four required zones
  (Asia/Bangkok, Asia/Shanghai, America/Los_Angeles, Pacific/Auckland) via `scripts/test-tz.mjs`.
- Playwright not installed (owner is in mainland China; browser download may stall). The qa subagents
  drive the app with the browser tool instead.

## Phase checklist
- [ ] Phase 4 — Running
- [ ] Phase 5 — Food, other activities, body
- [ ] Phase 6 — Today details, summary, daily grid
- [ ] Phase 7 — Backup, restore, AI export, banner, data deletion
- [ ] Phase 8 — Muscle picker on the body model
- [ ] Final pass
