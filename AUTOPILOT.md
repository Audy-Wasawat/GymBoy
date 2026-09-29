# Autopilot run: phases 4-8 and data deletion

The owner authorised this run. CLAUDE.md and SPEC.md still apply, except where this file says otherwise for this run.

## Goal
Build every remaining phase of SPEC.md first, then test the whole app with the subagents in `.claude/agents/` and fix what they find. Two stages:

- Stage 1: build phases 4 to 8 and the data-deletion tools, in order, without running the subagents in between.
- Stage 2: one full test-and-fix pass over everything, then the final report.

Order for Stage 1: 4 Running, 5 Food / other activities / body tracking, 6 Today details / summary / daily grid, 7 Backup / restore / AI export / browser-tab banner / data deletion, 8 Tap-on-model muscle picker.

## Resuming
The conversation may have been cleared. At the start of every session:
1. Run `git status` and `git log --oneline -10`, and read PROGRESS.md and DECISIONS.md if they exist.
2. If there is unfinished, uncommitted work, check that it builds and matches SPEC.md, then continue from it. Do not discard or rewrite it without telling the owner first.
3. If there is no PROGRESS.md, start at phase 4.
4. Say in one short line what state you found, then carry on.

## Permissions for this run
- Local git commits are allowed: one per finished phase, message "Phase N: <summary>". Never run `git push` (it is also blocked in settings).
- Approved devDependencies: `vitest`, `fake-indexeddb`, `@playwright/test`. Use Playwright only if its browsers install quickly. The owner is in mainland China and the download may be slow or blocked; if the install fails or stalls, skip Playwright and use your own browser tool instead.
- No new runtime dependency. Any other new dependency needs the owner's approval.
- Do not change behaviour that SPEC.md and the "Decisions already made" section do not cover. If something else seems worth changing, add it to DECISIONS.md under "Suggestions" and leave it alone.
- Tests must never touch the owner's real data: use fresh browser profiles and fake-indexeddb. Stop any dev or preview server you started.

## Progress files (keep them current so a compacted or restarted session can resume)
- `PROGRESS.md`: current phase, current step, last passing build, what is next.
- `DECISIONS.md`: every choice you made where the spec was silent, one line each with the reason, plus a "Suggestions" list.
Commit both with each phase commit.

## Stage 1: build each phase
1. Implement the phase per SPEC.md and the decisions below. Every UI string in both languages, theme tokens only, kg storage, date helpers only, no index on boolean fields, no external hosts, works offline.
2. Add vitest tests for the phase's pure logic and data functions (fake-indexeddb for database code) and an `npm test` script.
3. `npm run build` and `npm test` must pass before moving on, so mistakes do not pile up across phases.
4. Update PROGRESS.md and DECISIONS.md, tick the README roadmap, record what was built in SPEC.md, and commit locally.
Do not run the subagents in Stage 1.

## Stage 2: test and fix everything
Start when every phase in Stage 1 is built and committed.
1. Run the full test suite under `TZ=Asia/Bangkok`, `TZ=Asia/Shanghai`, `TZ=America/Los_Angeles` and `TZ=Pacific/Auckland`.
2. Run the subagents in parallel: spec-compliance-reviewer, data-integrity-auditor, offline-network-auditor, mobile-ux-reviewer, backup-restore-tester, and one qa-flow-tester per module (weights and history, running, food, other activities, body, summary and daily grid, backup and data deletion, muscle picker). A subagent starts with an empty context, so put in each prompt: which phases exist, the changes since the last push (`git diff --stat origin/main`), the routes and screens to exercise (read them from src/App.tsx), and how to start the app (command and port). Tell it to read CLAUDE.md and SPEC.md first.
3. Collect every finding, group duplicates, and fix all HIGH and MEDIUM ones, and LOW ones that are cheap. Add a regression test for each bug you fix where a test is possible.
4. Re-run the agents that reported findings, plus data-integrity-auditor and offline-network-auditor as a full regression. Repeat up to 5 rounds. Anything still open after that goes into the final report.
5. Done means: build passes, tests pass under all four time zones, and no agent reports an open HIGH or MEDIUM finding.
6. Commit the fixes locally (one commit per round is fine).

## Stop conditions
Stop and ask the owner only when:
- a fix would change behaviour the spec defines;
- a migration must transform existing data (new stores, empty stores and non-indexed fields are fine; bump `db.version` only when a change needs it, and say so in the report);
- a dependency outside the approved list is needed;
- you are blocked by permissions or the environment.
Otherwise keep going and record the choice in DECISIONS.md.

## Decisions already made

### Phase 4: Running
- Duration input: separate numeric fields for hours (optional), minutes and seconds, because the iOS decimal keypad has no ":". Pace is calculated (duration / distance, shown as m:ss per km), never typed.
- Distance in km with up to 2 decimals. Average and maximum heart rate: optional whole numbers 30-250. Surface: treadmill or outdoor, optional.
- Types: easy, LSD, tempo, interval (both languages).
- Interval plan: reps, per-rep distance (m) or per-rep duration, optional target pace, rest seconds. Result per rep: if the plan has a distance, enter the rep time and the pace is calculated; if it has a duration, enter the distance and the pace is calculated. History shows plan against actual per rep and the average rep pace. The run's total distance and time are entered as on the watch (including warm-up and cool-down), separate from the reps.
- Templates: "save this plan as a template" with a name; list, rename, delete; applying one only pre-fills the plan.
- Shoes: name; cumulative km is calculated from runs; retire toggle. A shoe that has runs cannot be deleted, only retired. A run's shoe can be changed later.
- Run history newest first, open / edit / delete with confirmation, add a past run with a date (never a future date; use `lib/dates` helpers).
- Charts reuse the lazy recharts chunk: pace over time with a type chip filter (interval shows average rep pace), the pace axis reversed so faster is higher; weekly distance (last 12 weeks, Monday weeks) and monthly distance (last 12 months).

### Phase 5: Food, other activities, body
- Photos: pick or take with `<input type="file" accept="image/*">`. Compress with a canvas to JPEG (Safari cannot encode WebP): longest side 800 px for body photos and 480 px for food photos, quality 0.75. Respect EXIF orientation (`createImageBitmap` with `imageOrientation: 'from-image'`). Store Blobs in IndexedDB and revoke object URLs.
- Food library: create / edit / delete, search, most recently used first, optional photo. Deleting a library food never changes past entries.
- Food entry: pick a food, a portion field (default 1, decimals allowed) multiplies kcal and protein; the entry's kcal and protein can be adjusted for that entry only. One-off entry: name, kcal, protein, with a switch "also save to library".
- Daily log: previous / next day and jump to a date, entries in the order added, daily totals, remaining kcal and protein against goals when set, edit / delete entries, add entries for past days.
- Goals (daily kcal, daily protein, weekly workout days) are editable in Settings, all optional.
- Other activities: sport name (free text with suggestions from past names, case-insensitive), minutes, effort 1-5 optional, note; list / edit / delete / backdate.
- Body: weight (shown in kg or lb, stored in kg) with an optional photo; list / edit / delete; weight chart (lazy chart chunk); compare any two dated photos side by side.

### Phase 6: Today details, summary, daily grid
- Today: food totals against goals, week progress (workout days against the weekly goal, running distance since Monday), the muscle model (already built), quick buttons.
- Summary (More, Summary): month navigation; workout days in the month (a day counts once across weights, runs and other activities); running distance per week and per month; average kcal and protein per day over days with at least one food entry; weekly goal progress.
- Daily grid as in SPEC.md: a column per week starting Monday, a row per weekday; red weights, blue running, half red and half blue when both on one day, yellow other sports, grey no log; filter buttons all / weights / running; tap a cell for that day's summary; about 22 weeks fit on a phone and older weeks scroll; days before the first log and future days are blank; no rest-day button. Each cell is a button with an aria-label (date and what was logged).

### Phase 7: Data (More, Backup and data)
- Full backup: one JSON file with every table, photos as base64 data URLs, `format: "gymboy-backup"`, `schemaVersion`, `exportedAt`, app version. Save with `navigator.share` and a File where available (iOS share sheet), otherwise a download link. Update `lastBackupAt` only after the share or download succeeds; a cancelled share sheet must not update it.
- Restore: pick a file, validate format and schemaVersion (refuse newer than the app), show counts, ask for confirmation, then replace everything in one transaction (all or nothing). Re-seed the exercise library if missing. Nothing may change if validation fails.
- Browser-tab banner: shown on every launch when the app is not running standalone, with install instructions (iOS: Share, Add to Home Screen) and a backup button. Never shown in standalone.
- AI export: period presets (this month, last 2 weeks, custom range, inclusive), category ticks (weights, running, other activities, food, body weight; all ticked by default), no photos. JSON with a `meta` block (exportedAt, period, units kg / km / sec / kcal / g, weeks start Monday, short notes on field meanings) and one array per category with stable field names and deterministic ordering. Weights: sessions with exercises (name, equipment, muscles, targets) and sets (type, weightKg, reps or left/right or duration, toFailure). Running: runs with calculated pace, plan, rep results, shoe name, heart rate, surface. Food: entries per day with daily totals and goals. Body: weights. Share with the share sheet or copy to the clipboard.
- The last backup date is shown in Settings.
- Data deletion. Deleting single entries already exists in the weights history; add the same for runs, food entries, library foods, other activities, body entries, shoes (retire instead when in use) and templates. Add a danger zone with two tools:
  1. Clear logged history by category (tick any): weights sessions, runs, food entries, other activities, body entries with photos. It keeps programs, the exercise library including custom exercises, the food library, shoes, run templates and settings.
  2. Erase everything: as a fresh install (programs, custom exercises, foods, shoes, templates and settings removed; the seeded exercises are re-seeded).
  Each tool shows counts ("This deletes 12 sessions and 30 sets"), offers "Back up first", then needs a typed confirmation word ("ลบ" in Thai, "DELETE" in English) and a final button. It runs in one transaction and also clears open sessions, drafts and rest-timer fields. Not reachable from Today.

### Phase 8: Muscle picker
- Custom exercise create and edit use the body model: tap a region to cycle none, primary, secondary, none; front and back toggle; the chips stay as the accessible alternative. Same colours as the display model.

## Final report
After Stage 2, write the report in Thai for the owner:
- what each phase built;
- bugs found and fixed per agent, and anything still open;
- the decisions from DECISIONS.md and the Suggestions list;
- main bundle size and lazy chunk sizes, and the `npm audit --omit=dev` result (report only, do not fix without asking);
- `git log --oneline` for the run;
- a checklist of what only a real iPhone can verify: rest-timer sound, wake lock, keyboard overlapping the bottom bars, share sheet, camera and photo picker, install and offline on the device, the swipe-back gesture in the history editor.
Do not push.
