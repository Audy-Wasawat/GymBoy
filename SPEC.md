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
- A body model highlighting the muscles of the program day chosen for today's session.
- Quick buttons: start a weight session, start a run entry, add food.

## Weight training

Programs are reusable, editable templates; a session records what was actually done and is never rewritten by later program edits.

**Programs**

- Several programs can be stored (for example "Upper/Lower Sep"). One is active at a time and stays active until the user switches it; there is no end date.
- A program has named days (Upper A, Lower A, ...). Each day lists the body parts trained and an ordered list of exercises.
- Each exercise in a day has a target number of sets, a target rep range (for example 6-8) and a rest time in seconds (default 90 s app-wide).

**Session flow**

1. Start a session and choose a day from the active program (no automatic suggestion), or start an empty session and add exercises as you go.
2. The day's exercises appear with last session's sets (weight x reps) beside the inputs and a "copy previous set" button.
3. Log each set: weight, reps, and a "to failure" tick. Each exercise also has a free-text note.
4. Changing, adding or removing exercises during a session affects that session only; the program stays as it was.

**Set types and left/right**

- Warm-up sets are a separate set type: optional, any number per exercise, and excluded from PR, progress charts and the weight-increase hint.
- An exercise can be marked left/right (for example bicep curl). Each set then has reps for left and reps for right, with one shared weight.
- Bodyweight exercises (for example pull-up) have an optional weight field for added load; empty means bodyweight only.

**Rest timer**

- Starts when a set is completed, using the exercise's rest time (else the default), and can be adjusted on the spot.
- It stores the end time rather than counting down, so it is correct after the screen locks; the screen is kept awake during a session where iOS allows (Screen Wake Lock), and the alarm sound plays only while the app is open.

**Progress signals**

- Weight-increase hint: shown when every working set reaches the top of the target rep range (both sides for left/right exercises). It only notifies and changes nothing.
- PR: the heaviest weight ever lifted in a working set for that exercise, reps ignored. A badge appears when it is beaten. For bodyweight exercises the PR is the heaviest added weight, or the most reps in one set if extra weight has never been used.
- Session duration is not recorded.

## Exercise library and body model

**Seeded exercises**

- About 250 popular exercises across barbell, dumbbell, machine/cable and bodyweight, grouped by body part and named in English only. Bodyweight core moves such as hanging knee raise are included.
- Each exercise carries one image, primary muscles, secondary muscles and a left/right flag. Images come from free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense / public domain), one image per exercise, compressed to small WebP files and bundled for offline use. Its coarse muscle names are remapped to the detailed regions below. The list and detail screens show the image beside a small body model with the muscles highlighted.
- Machine and cable variants are separate entries where the muscle emphasis differs; any entry can be duplicated and adjusted. The muscles of any seeded exercise can be re-marked on the body model if they feel wrong.

**Custom exercises**

- The user enters the name and equipment, then taps muscles on the body model to mark each one primary or secondary. Custom exercises have no photo. An exercise with no muscles marked is simply not highlighted.

**Body model**

- Front and back views, switchable.
- Regions: upper and lower chest, front/side/rear delts, biceps, triceps, forearms, abs, obliques, traps, lats, mid-back, lower back, glutes, quads, hamstrings, adductors, calves.
- Primary muscles drawn dark, secondary muscles lighter.

## Running

Runs are typed in after the fact; Apple Watch does the tracking, so the app needs no GPS or timer.

- Fields: date, type (easy, LSD, tempo, interval), distance (km), total time, average pace (calculated, min/km), shoe, note.
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

- Workout days in the month, with a calendar of active days. Weights, runs and other activities all count, and a day counts once.
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
- Theme: follows the phone's light/dark setting.
- Units: weight in kg or lb (stored in kg, shown in the chosen unit); distance in km, pace in min/km.
- Default rest time: 90 s.
- Goals: daily kcal, daily protein and weekly workout days, all optional.

## Build phases

1. [done] Project setup: PWA, Dexie schema, Thai/English, theme, tabs, Today, Settings.
2. Weights core: seeded exercise library (about 250, with images), custom exercises and muscle editing, programs, session logging (sets, warm-ups, failure, left/right, notes) and the rest timer.
3. History and progress: per-exercise history, charts, PR badge and weight-increase hint.
4. Running: run log, interval plan vs actual, templates, shoes, charts.
5. Food, other activities and body tracking.
6. Today screen details, weekly/monthly summary and goals.
7. Full backup, restore, browser-tab banner and AI export.
8. Body model: front/back SVG with primary and secondary muscle highlighting.

Phase 2 needs muscle data for the library and the muscle picker before phase 8 draws the full body model; a simple chip-based muscle picker is acceptable until then.

## Out of scope for v1

- Login, sync or any backend.
- Apple Health or Apple Watch import, GPS, lock-screen alerts.
- Barcode scanning, food database, AI calorie estimation.
- Ingredient breakdown, session duration, total lifting volume, body measurements.
