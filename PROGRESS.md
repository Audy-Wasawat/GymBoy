# Autopilot progress

Kept current so a compacted or restarted session can resume. See AUTOPILOT.md for the plan.

## Status
- **Current phase:** 8 (Muscle picker on body model) — done.
- **Last passing build:** Phase 8 — 52 tests green.
- **Next:** Stage 2 — run all 6 agents.

## Dev/preview servers
- A Vite dev server was started on http://localhost:5173 for the qa/mobile agents (HashRouter). Remember to stop it (`npm run dev` background task) before finishing the run.

## Test setup (done)
- devDeps added: `vitest`, `fake-indexeddb`.
- `npm test` runs the vitest suite once; `npm run test:tz` runs it under the four required zones
  (Asia/Bangkok, Asia/Shanghai, America/Los_Angeles, Pacific/Auckland) via `scripts/test-tz.mjs`.
- Playwright not installed (owner is in mainland China; browser download may stall). The qa subagents
  drive the app with the browser tool instead.

## Phase checklist
- [x] Phase 4 — Running
- [x] Phase 5 — Food, other activities, body
- [x] Phase 6 — Today details, summary, daily grid
- [x] Phase 7 — Backup, restore, AI export, banner, data deletion
- [x] Phase 8 — Muscle picker on the body model
- [ ] Stage 2 — Agents + final pass
