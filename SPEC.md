# Gymboy — App Specification (v1)

Exported 2026-09-29 from the living spec doc. When this file and a later decision disagree, ask the owner.

## Overview

Gymboy is an iPhone web app (PWA) for logging weight training, running, other sports and food, built to record quickly at the gym and review progress later. It is a logbook only: runs are tracked on Apple Watch and the numbers are typed in afterwards.

Principles:

- Record-first: each logging screen works one-handed in a few taps, with the previous values shown next to the inputs.
- Local-first: all data stays on the device; no account or backend in v1.
- Nothing changes silently: the app only notifies (for example "try adding weight") and never edits programs, food values or history by itself.
- Editing a session never rewrites the program, and editing a library item never rewrites past logs.
- Past entries can be added late, edited and deleted (delete asks for confirmation).

## Platform and tech stack

v1 is a local-first React PWA with no backend, installed on iPhone through Safari's "Add to Home Screen". The same code also installs on Android through Chrome; iPhone is the device tested first.

| Layer | Choice | Note |
| --- | --- | --- |
| App type | PWA, iPhone first, Android supported | Free, no Mac or Apple Developer account needed |
| Framework | React + Vite + TypeScript | |
| Offline | vite-plugin-pwa (service worker + manifest) | Gym signal is often poor |
| Storage | IndexedDB via Dexie | Ask for persistent storage where iOS allows |
| Charts | Recharts | |
| Styling | Tailwind CSS | Large touch targets, safe-area aware |
| Body model | Hand-authored SVG, front and back | |
| Languages | Thai and English, switchable | |
| Hosting | Vercel | HTTPS is required for a PWA |

iOS limits to design around: no reliable alerts while the screen is locked, no Web vibration, and no automatic writing to Files (backups are exported manually).

## Navigation and Today screen

Five bottom tabs: **Today · Weights · Running · Food · More**. "More" holds Summary, Body, Other activities, Shoes, Export/Backup and Settings.

Today is the first screen and shows:

- What was done today (weights, runs, other activities).
- Today's food: kcal and protein, compared with goals if set.
- This week's progress: workout days against the weekly goal, and running distance so far.
- A body model highlighting the muscles of every exercise that has at least one working set logged today, including exercises added to that session on the spot (primary dark, secondary light). Exercises with no sets yet, or with warm-up sets only, do not count.
- Quick buttons: start a weight session, start a run entry, add food.

## Weight training

Programs are reusable, editable templates; a session records what was actually done and is never rewritten by later program edits.

**Programs**

- Programs are optional: training by feel with empty sessions needs no program at all.
- Several programs can be stored (for example "Upper/Lower Sep"). One is active at a time and stays active until the user switches it; there is no end date.
- Programs and days are free-form, with no built-in templates: the user names each day and picks its exercises (a day may cover a single body part, for example "Chest only"). Days are ordered, and each day has an ordered list of exercises. A day's body parts are worked out from its exercises, never picked by hand.
- Each exercise in a day has a target number of sets, a target rep range (for example 6-8) and a rest time in seconds (default 90 s app-wide). For timed exercises the target range is in seconds (for example 30-45 s).
- An exercise added to a day starts at 2 sets of 6-8 reps (timed: 30-60 s) with the app-wide rest time; each value can be edited per exercise.
- Deleting a program or a day never changes sessions already logged.

**Session flow**

1. Start a session from a day of the active program (no automatic suggestion; to train another program, switch the active program first), or start an empty session with one tap. The Weights screen always offers the empty session, with or without programs. Only one session is open at a time.
2. Exercises can be added from the library at any time during a session: search, filter by body part and by equipment, with the 10 most recently used exercises listed first.
3. Each exercise shows the previous session's working sets (weight x reps, in the chosen unit) beside the matching rows, set by set; "previous" is the most recent other session with that exercise, whether or not it came from a program. Rows beyond the previous session's count show nothing. Tapping the previous value copies it into the row (or copies the set above when there is no previous value).
4. Log each set: weight, reps, and a "to failure" tick, then save it with ✓. Each exercise also has a free-text note. Timed exercises log a duration in seconds instead of reps (typing mm:ss is also accepted), with an optional weight field for added load; there is no hold timer. Number fields accept "," as the decimal mark.
5. Changing, adding or removing exercises during a session affects that session only; the program stays as it was.
6. A session's date is the device's local date when it starts. A session without a program day is named after the body parts actually trained (for example "Chest, Shoulders") on every screen that shows sessions. Body parts count only exercises with at least one saved working set.

**Drafts and recovery**

- Values typed into a row but not yet saved with ✓ are kept in the database as drafts, so they survive iOS closing the app in the background or switching apps.
- Drafts never count as logged sets: they do not affect "previous", PRs or the Today muscle highlight.

**Finishing a session**

- Finish: if any row has something typed but is not saved, the app asks "Save" or "Discard"; nothing is dropped silently. Completely empty rows are dropped without asking, and rows missing a required value cannot be saved (the prompt says how many will be dropped).
- Exercises left with no saved sets are removed from the session when it finishes, after a confirmation listing them.
- A session with no saved sets at all is deleted when finished, after a confirmation.
- Cancel session deletes the open session and its sets, after a confirmation.
- If a session from an earlier day is still open when the app is opened (or brought back), the app asks "Finish" or "Keep going". Finishing follows the rules above; keeping going leaves the session on its original date.

**Set types and left/right**

- Warm-up sets are a separate set type: optional, any number per exercise, and excluded from PR, progress charts and the weight-increase hint.
- An exercise can be marked left/right (for example bicep curl). Each set then has reps for left and reps for right, with one shared weight.
- Bodyweight exercises (for example pull-up) have an optional weight field for added load; empty means bodyweight only.
- Timed exercises (for example plank) record a duration per set instead of reps; a timed left/right exercise records a duration for each side.
- A session copies each exercise's left/right, bodyweight and timed settings when it is logged, so changing them later affects only the next sessions.

**Rest timer**

- Starts only when a working set is saved with ✓ (never after a warm-up set), using the exercise's rest time (else the default). It can be adjusted by ±15 s or skipped.
- When the time is up the bar turns red and flashes. It sits above the tab bar and hides while a field is being typed in, so it never covers an input.
- iOS only allows sound after a tap, so sound is unlocked on the tap that saves a set.
- It stores the end time rather than counting down, so it is correct after the screen locks; the screen is kept awake during a session where iOS allows (Screen Wake Lock, requested again whenever the app returns to the foreground; if it is unavailable the app carries on), and the alarm sound plays only while the app is open.

**Progress signals**

- Weight-increase hint: shown when every working set of the previous session with that exercise reached the top of the target range that session had copied (both sides for left/right exercises; for timed exercises the top of the range in seconds), and that session had at least as many working sets as its target. Warm-ups never count. Exercises whose previous session had no target (for example added to an empty session) get no hint. It appears on the exercise card in the next session (for example "Last time you hit 8 reps on every set at 60 kg. Try adding weight.") and on the exercise's history screen, and it hides once the current session has a saved working set heavier than last time. It only notifies and changes nothing.
- What a set is measured by (for PRs and the chart): normal exercises use weight, reps ignored (left and right share one weight). Bodyweight and timed exercises use the heaviest added weight if weight has ever been added to that exercise; otherwise the most reps (bodyweight) or longest duration (timed) in one set, taking the lower side for left/right exercises. The exercise's current bodyweight and timed settings decide this; sets without the value measured are left out.
- PR: a working set is a PR when it beats every earlier working set of that exercise (ordered by date, then session, then set). Sets in the very first session with that exercise are never PRs, since there is nothing to compare with; within a later session every set that beats all sets before it counts. Warm-ups never count.
- PRs are always worked out from the logged sets and never stored, so editing, moving or deleting history keeps them correct.
- A PR badge shows on the set row in the session as soon as the set is saved, and on every record-setting set in the history. The exercise's history screen shows the current record separately at the top.
- Session duration is not recorded.

**History**

- Session history (from the Weights screen) lists finished sessions, newest first, with date, name, number of exercises and number of sets.
- Opening a finished session allows editing: set values, warm-up/working type and the "to failure" tick; deleting a set, an exercise or the whole session (each asks for confirmation); adding sets or exercises; and changing the date (never to a future date). Moving a session also moves the date stored on each of its sets.
- Rows added in history are kept on screen only until saved with ✓; nothing is stored as a draft in a finished session. Leaving the screen through an in-app link (the back arrow or the tab bar) while such a row has numbers typed asks first ("Leave without saving" or "Stay"); with nothing typed it leaves without asking.
- Deleting the last set of an exercise removes the exercise, and removing the last exercise deletes the session; the confirmation says so. No finished session or exercise is ever left without sets.
- A past session can be added for any date up to today. It starts empty and is created when its first set is saved.
- A session's body parts are worked out again after every edit or delete.
- Weights are shown in the chosen unit and always stored in kg.

**Exercise history and chart**

- Each exercise has a history screen, opened from the exercise's detail screen or from its card during a session: the current record, the weight-increase hint, a chart, and every session with that exercise (date, name and working sets such as "60×8, 60×7", with record-setting sets marked). Tapping a session opens it.
- The chart is a line chart with one point per session: the best set by the same measure as PRs. Tapping a point shows its date and value. It uses the weights plate red and follows light and dark mode.
- With fewer than two sessions a short message replaces the chart. Sessions left off because none of their sets has the value measured (for example after the exercise's settings changed) are counted in a short note.
- The chart library is loaded only when a chart is shown and is cached for offline use like the rest of the app.

## Exercise library and body model

**Seeded exercises**

- 249 popular exercises across barbell, dumbbell, machine/cable and bodyweight, grouped by body part and named in English only. Bodyweight core moves such as hanging knee raise are included.
- Each exercise carries primary muscles, secondary muscles, a left/right flag and a timed flag. Seeded timed exercises: plank, side plank (left/right), farmer's walk and plate pinch.
- v1 has no exercise photos or drawings. Exercise names and muscle data come from free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense / public domain); its images are not used. Its coarse muscle names are remapped to the detailed regions below. An empty `image` field is kept in the data for later.
- The list shows a small front-and-back body model beside each exercise, and the detail screen a larger one, with the muscle names also shown as text chips.
- Machine and cable variants are separate entries where the muscle emphasis differs; any entry can be duplicated and adjusted. The muscles of any seeded exercise can be re-marked on the body model if they feel wrong.

**Custom exercises**

- The user enters the name and equipment, then taps muscles on the body model to mark each one primary or secondary. Custom exercises have no photo. An exercise with no muscles marked is simply not highlighted.
- Every exercise, seeded or custom, has "Left/right" and "Timed" switches on its detail screen. Changing them affects the next sessions only.

**Body model**

- Drawn in code as a flat SVG figure (not realistic, but each region is recognisable), with front, back or both views side by side, at any size.
- Regions: upper and lower chest, front/side/rear delts, biceps, triceps, forearms, abs, obliques, traps, lats, mid-back, lower back, glutes, quads, hamstrings, adductors, calves.
- Primary muscles in the weights plate red, secondary muscles in the same red at about 35 %, other regions in a neutral theme tone; it follows light and dark mode.
- It carries an accessible label listing the primary and secondary muscles.
- Tapping regions on the model to mark muscles comes in phase 8; until then muscles are picked with chips.

## Running

Runs are typed in after the fact; Apple Watch does the tracking, so the app needs no GPS or timer.

- Fields: date, type (easy, LSD, tempo, interval), distance (km), total time, average pace (calculated, min/km), shoe, note, average and maximum heart rate (optional), and a treadmill/outdoor tag (optional).
- Interval runs have a plan and a result. The plan is the number of reps, distance or time per rep, target pace and rest; the result is the time or pace of each rep. History shows plan against actual.
- Templates: a run plan can be saved (for example "6x800 m @ 3:40") and reused, which pre-fills the plan for a new run.
- Shoes: a list of pairs, chosen per run, with cumulative distance per pair and an option to retire a pair.
- Charts: pace over time by session type, and weekly/monthly distance.

## Other activities

Any other sport (for example badminton) is logged with sport name, date, duration in minutes and a note, plus an optional effort rating from 1 to 5. Sport names are free text and remembered for next time. These entries count toward workout days.

## Nutrition

Food is logged as calories and protein only, from a reusable food library.

- Food library: each food has a name, kcal, protein (g) and an optional photo (compressed on upload). A separate edit screen changes a food's default values.
- Daily log: one list per day with no meal categories, in the order added. Picking a food copies its kcal and protein into the entry, with a portion field (default 1, for example 1.5 plates) that multiplies both.
- Adjusting an entry changes that entry only; library edits never change past days.
- One-off foods: enter name, kcal and protein directly, with a switch to also save it to the library.
- Daily totals of kcal and protein, with past days browsable.
- Optional daily goals for kcal and protein, each set independently; when set, the remaining amount is shown.
- No ingredient breakdown.

## Body tracking

Each entry records date and body weight, with an optional progress photo. A weight chart shows the trend, and any two dated photos can be compared side by side. Photos are compressed on upload.

## Weekly and monthly summary

- Workout days in the month. Weights, runs and other activities all count, and a day counts once.
- Activity grid in the style of GitHub's contribution graph: one column per week starting on Monday, one row per weekday. Red = weights, blue = running, half red and half blue = both on the same day, yellow = other sports, grey = nothing logged. Filters: all / weights / running. Tapping a cell shows that day's summary. Days before the first entry are left blank. There is no rest-day button.
- Optional weekly goal for workout days. Weeks start on Monday.
- Running distance per week and per month.
- Average kcal and protein per day for the month, over days that have at least one food entry.
- Total lifting volume is not shown.

## Data, backup and AI export

- Full backup: one JSON file with everything, including compressed photos, saved through the iOS share sheet and restored with Import.
- Backup reminder: none when the app runs from the home screen. When opened in a browser tab, a banner on every launch asks the user to install the app and back up. The last backup date is always shown in Settings.
- AI export: a JSON file for a chosen period (this month, last 2 weeks, or a custom range). Before each export the user ticks which categories to include: weights, running, other activities, food, body weight. Photos are never included.
- Sharing uses the share sheet or copy to clipboard.

## Settings and defaults

- Language: Thai or English (interface only; seeded exercise names stay in English).
- Dates always show the Common Era (Gregorian) year, in Thai too (for example "27 ก.ย. 2026"); Thai keeps Thai month names.
- Theme: follows the phone's light/dark setting.
- Units: weight in kg or lb (stored in kg, shown in the chosen unit); distance in km, pace in min/km.
- Default rest time: 90 s.
- Goals: daily kcal, daily protein and weekly workout days, all optional.

## Build phases

1. [done] Project setup: PWA, Dexie schema, Thai/English, theme, tabs, Today, Settings.
2. [done] Weights core: seeded exercise library (249, no images), the body model drawing (front/back SVG with highlighting), custom exercises and muscle editing, programs, session logging (sets, warm-ups, failure, left/right, timed, notes) and the rest timer. At the end of phase 2 the Today screen shows the body model for today's logged exercises.
3. [done] History and progress: per-exercise history, charts, PR badge and weight-increase hint.
4. [done] Running: run log (including optional heart rate and treadmill/outdoor tag), interval plan vs actual, templates, shoes, charts.
5. [done] Food, other activities and body tracking.
6. [done] Today screen details, weekly/monthly summary with the activity grid, and goals.
7. [done] Full backup, restore, browser-tab banner and AI export.
8. [done] Body model: tap regions on the model to mark muscles primary or secondary (replaces the chip picker).

Phase 2 draws the body model for display; picking muscles uses chips until phase 8 adds tapping on the model.

## Out of scope for v1

- Login, sync or any backend.
- Apple Health or Apple Watch import, GPS, lock-screen alerts.
- Barcode scanning, food database, AI calorie estimation.
- Ingredient breakdown, session duration, total lifting volume, body measurements.
