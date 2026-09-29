# Decisions

One line per choice made where SPEC.md and AUTOPILOT.md were silent, with the reason.
"Suggestions" at the bottom lists things left alone that may be worth changing later.

## Test infrastructure
- Chose `vitest` + `fake-indexeddb` (both approved). Node environment; the app UI is exercised by the qa subagents in a browser, so no jsdom dependency was added.
- Time zones are passed to tests through a `GYMBOY_TZ` env var read in `src/test/setup.ts`, because this Windows shell strips a bare `TZ=` prefix before it reaches Node. `npm run test:tz` loops the four required zones.
- Playwright was not installed (owner in mainland China; download risk). Recorded per AUTOPILOT permission to skip it.

## Phase 4: Running
- HR, surface (treadmill/outdoor) and per-rep distance were added as **non-indexed** fields on the existing `runs` store, so no `db.version` bump was needed (allowed by AUTOPILOT).
- `IntervalRepResult` gained `distanceM` so a time-based interval plan can store the entered per-rep distance; `paceSecPerKm` is stored per rep so history/charts/AI export need no recompute.
- The run editor doubles as the run detail/history view (open to see plan-vs-actual and average rep pace, edit, or delete). No separate read-only screen — simpler and matches "open/edit/delete".
- Charts reuse recharts via a second lazy component (`RunChartsView`); Vite puts recharts in a shared lazy chunk, so it stays out of the main bundle.
- Fixed a pre-existing `formatPace` bug that could print ":60" (rounded total then split) and made `parseDuration` reject a seconds field above 59 — both are correctness bug-fixes surfaced by Phase 4's heavy pace use.
- HR outside 30–250 now shows an inline message instead of being dropped silently; the Save button is disabled while a save is in flight (guards a double-tap).
- The future-date guard shows a dedicated `run.futureDate` message; mm:ss fields (target pace, per-rep time) use `inputMode="text"` because the iOS numeric keypad has no ":".

## Phase 5: Food, other activities, body
- `listFoodsMRU` sorts by `time` in memory (no index) rather than bumping `db.version` — foodEntries are few, so a full scan is fine and avoids a migration.
- Body chart shows as a toggle button to save vertical space; only visible when there are ≥2 entries.
- Body compare: user picks ≤2 entries with photos via a toggle-select UI; no separate screen needed.
- Goals (kcal, protein, weeklyDays) edited via blur/onBlur inputs in Settings — updates fire per-field on blur.
- `capture="user"` on body photo input to open the front camera by default.

## Phase 6: Today details, summary, daily grid
- Today screen had all required content already (muscles, food totals, week stats, quick buttons) — no changes needed beyond Phase 5 goals wiring.
- ActivityGrid uses horizontal scroll with week-columns and weekday-rows (22+ weeks fit as needed). Cells are buttons with aria-labels.
- Day popup is a bottom sheet (fixed + items-end) to match iOS patterns; tapping outside dismisses it.
- Summary and grid are on one page (`/more/summary`) — no separate grid route needed.

## Phase 7: Data
- Full backup serialises photos to data URLs (FileReader); restore converts back to Blobs.
- `shareOrDownload`: tries `navigator.share({files})` first; falls back to a temporary `<a download>` link; AI export falls back to clipboard.
- BrowserBanner dismissed via sessionStorage (shows again after reload per AUTOPILOT spec — "every launch").
- Confirmation word: "ลบ" in Thai mode, "DELETE" in English mode.
- No `db.version` bump needed: no new stores or index changes.
- `eraseEverything` wipes all stores then re-seeds and re-creates settings in one flow.

## Phase 8: Muscle picker
- `BodyModelPicker` wraps an interactive SVG figure + the existing `MusclePicker` chips (accessible fallback).
- Display model (`BodyModel`) remains visible on the ExerciseDetail read-only view; `BodyModelPicker` replaces it only in edit mode.
- SVG shapes are inline path/ellipse data matching the existing `BodyModel` layout; regions click to cycle none → primary → secondary → none.
- No `db.version` bump needed; no new stores or index changes.

## Suggestions
- (none yet)
