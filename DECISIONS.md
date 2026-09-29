# Decisions

One line per choice made where SPEC.md and AUTOPILOT.md were silent, with the reason.
"Suggestions" at the bottom lists things left alone that may be worth changing later.

## Test infrastructure
- Chose `vitest` + `fake-indexeddb` (both approved). Node environment; the app UI is exercised by the qa subagents in a browser, so no jsdom dependency was added.
- Time zones are passed to tests through a `GYMBOY_TZ` env var read in `src/test/setup.ts`, because this Windows shell strips a bare `TZ=` prefix before it reaches Node. `npm run test:tz` loops the four required zones.
- Playwright was not installed (the browser download can stall on a poor connection). Recorded per AUTOPILOT permission to skip it.

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

## Stage 2 agent findings (fixed)
- **Today locale**: `'th-TH'` → `'th-TH-u-ca-gregory'` to show CE year (Gregorian) per spec.
- **Today quick buttons**: now go directly to `/running/new` and `/food/add` per spec ("Quick buttons: start a run entry, add food").
- **window.confirm() → Sheet**: FoodEntryEditor, BodyEntryEditor, Activities, FoodLibraryEditor, Backup (restore) — `window.confirm` is silently blocked on iOS PWA installed mode.
- **Input validation**: FoodEntryEditor rejects negative/zero/Infinity portion and kcal; BodyEntryEditor uses `isFinite` to reject Infinity weight (e.g. `1e500`).
- **ActivityGrid filter**: running filter active button uses `bg-running` not `bg-weights`.
- **BodyChartView**: passes `language` prop from Body.tsx; both `formatDate` calls use it; raw RGBA grid color replaced with `rgb(var(--line)/0.4)` token.
- **BodyModelPicker**: SVG is `aria-hidden`, toggle buttons have `aria-pressed`, 'Front'/'Back' use i18n strings.
- **Segmented**: min-h 36→44 px throughout the app.
- **RunEditor repDurationSec**: `inputMode="text"` so iOS shows a colon key (mm:ss format).
- **Food.tsx**: jump-to-date via transparent `<input type="date">` overlay on the date label.
- **SetRow**: double-tap guard with `confirming` state flag.
- **backup.ts**: `parseBackup` validates all required table keys are arrays; schema version < 1 now rejected; v1 backup migration (nameEn/nameTh → name) applied on restore; `ensureSettings()` called after restore; `shareOrDownload` rethrows non-AbortError; URL revoke delayed 100 ms; AI export filters open sessions; inline pace division replaced with `paceSecPerKm()` helper.
- **Backup.tsx**: ClearHistory calls `getDeleteCounts` and displays count summary; custom date range with from > to is rejected with error message; all raw Tailwind red tokens replaced with `text-weights` / `border-weights` / `bg-weights`.
- **LOW findings deferred**: DST edge-case in Summary.tsx Sunday arithmetic (Thailand has no DST), RestBar aria-live tick announcements, duplicate icon entries in SW precache, Page.tsx hardcoded "Back" aria-label — none affect correctness for the primary use case.

## Round 2 (fixes, picker, library, one-sided lifts, shoes, photos)

### Part 0: housekeeping
- The rebase of the local "Stop tracking local Claude Code helper files" commit onto origin/main stopped because the three helper files were untracked locally but tracked upstream. They were copied aside, the rebase ran clean (no conflict; .gitignore has the union of both sides), and the files were put back. `NEXT_TASKS.md` is ignored too.

### Part A: fixes
- **A1** The banner is z-30, every Sheet, the picker and the day popup z-50. The rest bar is also z-30 and sits at almost the same place as the banner; that overlap is old and was left alone (the banner only shows in a browser tab).
- **A2** One function, `workoutSessions()` in `src/db/workoutDays.ts`, decides what a workout is: a session with at least one saved set of any type. Today (list and week count), the summary (month and week) and the grid all use it. An open session with a saved set counts, one with only drafts does not.
- **A3** The run list shows the **overall** average pace (distance and total time) for every run type. It cannot mislead: it is the same number as the "average pace" field of the run screen, and an interval run is not shown by its fast reps alone. The fast-rep pace stays in the run detail and the chart.
- **A4** The weights part of the AI export lists all sets, warm-ups included, plus `order` per exercise and `setNumber` per set, sorted by them. I also added `durationLeftSec`, `durationRightSec` and the exercise `note`, which were missing (a timed left/right set exported without its times). Sets are matched to exercises by id, not by date.
- **A5** Grid cells, month arrows and the Back arrow use the app language (`gridCellLabel`, `sum.prevMonth`, `sum.nextMonth`, `common.back`). Photo `alt` texts no longer show a raw date. Two visible English words found by a wider search ("g protein" in the library list and the grid popup) now use the existing strings. The user-visible error text was `String(error)` (English, technical): it is now `error.generic` / `backup.restoreFailed`.
- **A6** `shareOrDownload` only stops when the share sheet was dismissed (AbortError); any other error falls back to the download. The confirmation word ignores surrounding spaces and letter case (`confirmWordMatches`).
- **A7** The location sentences are gone from CLAUDE.md, DECISIONS.md and the offline auditor. PROGRESS.md and AUTOPILOT.md (ignored files) were left for the owner.

### Part B: picker and search
- **B1** The picker body is mounted only while open, so its state cannot survive a close (structural fix), and a pick also resets it. There is no DOM test library (only vitest, fake-indexeddb and Playwright were approved), so the test checks the structure (closed renders nothing; open is a fresh `PickerBody`) and the reducer, and the real flow is covered by the browser QA. A jsdom + Testing Library dev dependency would allow true component tests; ask before adding it.
- **B2** Ranking: every query word gets a score against the exercise (name exact 0, name prefix 1, name contained 2, then the same three for equipment / body part / primary muscles + 3); the scores add up; lower is better; ties are alphabetical. So name matches come first, then muscle or equipment matches. Singular forms are compared as well (biceps/bicep, crunches/crunch, raises/raise) and only when 3 letters or longer, so "abs" does not turn into "ab" and match "abduction". A small alias table adds words people type (ไบเซป, ไตรเซป, ขา, abs, delts, quads, calf, leg ...) to the muscle and body-part labels. Thai "หลัง" also finds the hamstrings ("ต้นขาหลัง" contains it) but the exact match ranks first.
- **B3** The create form lives in `ExerciseForm`, used by the New exercise screen and the picker overlay. The "Create new exercise" row shows while searching, and when nothing matches (including when only the filters leave nothing). A duplicate name (case-insensitive) opens a choice: use the existing one, create anyway, or go back. The name is not blocked.
- **B4** `bodyPartOf` is computed on read. Session body parts are stored on the session, so they are worked out again for every session when the app starts and when an exercise's muscles or body part are edited (`recomputeAllBodyParts`). The "None (My exercises)" wording of the body part selector was left alone; it is slightly off now (an exercise without a body part follows its muscles first) and could be reworded.

### Part C: library (625 exercises)
- The 249 hand-picked exercises are byte-for-byte unchanged (a fingerprint test guards it); 353 more come from free-exercise-db by rule; 23 extras come from `scripts/extra-exercises.json`.
- **Included:** category strength or powerlifting, not already picked. **Excluded:** foam roll, olympic lifts (any name with clean, snatch or jerk except "clean grip" squats, so Power Clean stays out), assisted variants, manual/partner moves. 24 entries were left out; the list prints with `node scripts/build-exercises.mjs --check`.
- **Equipment:** barbell and e-z curl bar -> barbell; dumbbell; machine (also anything with "Smith"); cable; body only -> bodyweight; kettlebells, bands, medicine ball, exercise ball, other -> other. Strength entries with no equipment (4) are bodyweight moves and map to bodyweight. Rings, bars and plates listed as "other" that are done with body weight (dips, chins, muscle-ups, suspended work ...) keep equipment "other" but get the bodyweight flag, so the added weight is optional.
- **Muscles:** the existing coarse table plus name rules. chest: incline -> upper, decline or dip -> lower, else both. shoulders: rotation or rear/reverse fly/face pull/bent-over raise -> rear; lateral or side raise or upright row -> side; front -> front; press, overhead, Arnold, thruster, handstand, jammer, military, Cuban, scaption -> front and side; as a secondary muscle of a pull -> rear, otherwise front. lats: rows -> lats and mid back; pulldown, pull-up, chin -> lats. middle back: chin or pull-up -> lats then mid back, otherwise mid back then lats. abdominals: twist, oblique, side bend, windmill, wood chop, Russian, Pallof, rotation -> obliques and abs. neck -> traps. abductors -> glutes. Deadlifts and rack pulls with a lower-back primary also get glutes and hamstrings, like the hand-picked Deadlift.
- **Left/right:** single/one arm or leg, alternating, unilateral, lunge, split squat, step-up, pistol, kickback, Bulgarian, windmill, side bend, and concentration curls with a dumbbell. **Timed:** plank, hold, carry, wall sit, dead hang, isometric, battling ropes, balance, walks (not lunges, not monster walk, not "push-up to side plank").
- **C2 extras** (all new names, no duplicates): Machine Lateral Raise, Machine Incline Chest Press, Machine Seated Row, Machine Low Row, Machine Pullover, Machine Torso Rotation, Machine Back Extension, Machine Glute Kickback, Hip Thrust Machine, Dumbbell Hip Thrust, Wide-Stance Leg Press, Cable Leg Extension, Leg Extension with Band, Reverse Nordic Curl, Cable Leg Curl, Bodyweight Calf Raise, Copenhagen Plank, Side-Lying Hip Adduction, Cossack Squat, Barbell Sumo Squat, Kettlebell Sumo Squat, Dumbbell Lateral Lunge, Adductor Ball Squeeze. **Not added:** "Standing Cable Crunch (Rope)", because the source already has "Standing Rope Crunch" (cable, abs); searching "standing cable crunch" finds it.
- **C3 coverage** (primary muscles; `node scripts/audit-exercises.mjs`). Targets met: every region has 10 or more, and every family has at least 3 equipment types.

| Region | barbell | dumbbell | machine | cable | bodyweight | other | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| chest_upper | 7 | 13 | 7 | 8 | 11 | 11 | 57 |
| chest_lower | 9 | 10 | 7 | 6 | 10 | 11 | 53 |
| delt_front | 13 | 21 | 4 | 5 | 1 | 19 | 63 |
| delt_side | 10 | 22 | 3 | 6 | 0 | 19 | 60 |
| delt_rear | 1 | 8 | 1 | 6 | 0 | 5 | 21 |
| biceps | 14 | 24 | 2 | 9 | 0 | 1 | 50 |
| triceps | 20 | 17 | 3 | 12 | 8 | 9 | 69 |
| forearms | 8 | 8 | 0 | 2 | 0 | 4 | 22 |
| abs | 7 | 1 | 2 | 13 | 41 | 14 | 78 |
| obliques | 3 | 1 | 1 | 8 | 8 | 7 | 28 |
| traps | 3 | 2 | 4 | 2 | 3 | 5 | 19 |
| lats | 6 | 2 | 4 | 14 | 5 | 18 | 49 |
| mid_back | 9 | 5 | 5 | 5 | 1 | 10 | 35 |
| lower_back | 9 | 0 | 1 | 0 | 3 | 2 | 15 |
| glutes | 11 | 1 | 4 | 2 | 6 | 6 | 30 |
| quads | 30 | 9 | 15 | 2 | 7 | 10 | 73 |
| hamstrings | 15 | 2 | 5 | 1 | 4 | 6 | 33 |
| adductors | 2 | 2 | 2 | 1 | 3 | 3 | 13 |
| calves | 3 | 3 | 6 | 0 | 1 | 3 | 16 |

| Family | barbell | dumbbell | machine | cable | bodyweight | other | Types |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| curl (biceps) | 14 | 24 | 2 | 9 | 0 | 1 | 5 |
| chest press | 7 | 8 | 9 | 4 | 0 | 6 | 5 |
| shoulder press | 8 | 10 | 3 | 3 | 0 | 10 | 5 |
| row | 8 | 4 | 6 | 6 | 1 | 8 | 6 |
| lateral / front raise | 3 | 14 | 2 | 3 | 0 | 2 | 5 |
| triceps extension / pushdown | 6 | 13 | 1 | 12 | 1 | 5 | 6 |
| leg extension (knee extension) | 0 | 0 | 2 | 1 | 2 | 1 | 4 |
| pulldown / pull-up | 0 | 0 | 7 | 9 | 5 | 5 | 4 |
| squat | 25 | 5 | 7 | 0 | 4 | 7 | 5 |
| lunge / split squat | 5 | 5 | 2 | 0 | 2 | 3 | 5 |
| deadlift / hip hinge | 17 | 2 | 3 | 2 | 2 | 5 | 6 |
| crunch / leg raise | 1 | 0 | 2 | 7 | 27 | 3 | 5 |
| calf raise | 3 | 3 | 6 | 0 | 1 | 2 | 5 |
| hip thrust / glute bridge | 2 | 1 | 2 | 1 | 3 | 1 | 6 |
| leg curl (hamstring curl) | 0 | 0 | 3 | 1 | 2 | 1 | 4 |
| fly / crossover | 1 | 7 | 2 | 6 | 0 | 2 | 5 |
| shrug | 2 | 2 | 3 | 1 | 0 | 0 | 4 |
| rotation / twist | 2 | 0 | 1 | 5 | 1 | 1 | 5 |

- Thin spots that are real-world gaps, not missing data: rear delts with a barbell or machine (1 each), lower back with a dumbbell or cable (0), forearms with a machine (0), calves with a cable (0), machine curls (2), bodyweight lateral or front raises (0). The 30-exercise spot check (`node scripts/audit-exercises.mjs`, seeded so it repeats) found no clear error; the rules were changed twice from it (an all-purpose "crunch" rule wrongly made cable crunches bodyweight; a barbell concentration curl was flagged left/right).
- The source data is read from the pinned commit named in `exercise-picks.json`. The script takes `--source-file=` for a saved copy when the network is slow.

### Part D: one-sided lifts
- The switch is in the exercise card menu of a session, disabled with a reason once the exercise has a saved set. Turning it on or off also updates the exercise's own default, so the last-used mode is remembered (decided as asked). Rows typed but not saved are converted (one value <-> left and right, taking the lower one when going back) and remounted, so nothing typed is lost.
- Everything that reads a set now works from what the set holds: `setSummary` shows a single value or "l/r" as logged, `setToText` fills both sides from one value or takes the lower side, PRs and the chart use the lower side for reps or seconds, and the hint follows the previous session's own mode.
- The detail screen's left/right text says it applies to the next sessions and points to the session menu.

### Part E: shoes
- `Shoe.startKm` is a non-indexed field (no `db.version` change). Empty means 0; a comma works; more than 2 decimals or a negative number is refused with a message (nothing is rounded silently); the upper limit is 100000 km.
- The list line uses the app's unit ("กม." in Thai, "km" in English).

### Part F: photos
- `FoodEntry.photo` is a non-indexed Blob (no `db.version` change). Backups now write it as a data URL. `blobToDataUrl` uses `Blob.arrayBuffer()` instead of `FileReader`, so it also runs in the Node tests. A restored photo that is not a data URL (for example the `{}` an old buggy export could have produced) is dropped instead of stored.
- "Remove photo" is offered on the food entry and library screens. The body screen has the two add buttons only (as asked); it still cannot remove a photo without deleting the entry.
- **Sizes** (measured in the browser pane on real photographs from Windows' own wallpapers, 7 files of 1920 to 6400 px; a repeatable set is not kept): food photos (480 px) average 13 KB (6.7 to 21 KB), body photos (800 px) average 25 KB (12 to 41 KB), single-pass quality 0.75. A worst case of a very detailed 3024x2268 picture came out at 42 KB (food) and 57 KB (body, after the step-down to 680 px). Compression now steps down until a photo fits 60 KB, so the bound holds even for that case. EXIF orientation 6 (a landscape file that must be shown portrait) came out 300x480, matching the same photo rotated 90 degrees clockwise (pixel difference 2, against 51 to 60 for the other rotations), 18 KB. Real food and selfie photos are more detailed than scenery, so expect somewhat more; the owner should check a few on the iPhone.
- The library screen uses the same buttons as the entry screen (and can remove a photo); choosing a photo shows a short progress line and an error text if the image cannot be read.

### Also found, not changed (suggestions)
- Editing a food entry sets its `time` to now and clears its `foodId` (the update writes `foodId: undefined`), so an edited entry jumps to the end of the day and loses its link to the library food. Worth a small fix; not in this round's list.
- The rest bar and the browser-tab banner overlap in the same place.

## Suggestions
- (none yet)
