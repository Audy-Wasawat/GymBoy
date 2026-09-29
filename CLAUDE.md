# Gymboy: rules for Claude Code

Read `SPEC.md` before any feature work. It is the source of truth for behaviour.

## Working agreement (most important)

- **Never run `git push`.** The owner reviews and pushes every change. Committing locally is fine only when asked.
- **Do not change anything the owner did not ask for** (features, layout, colours, wording, dependencies, file structure). If a change seems needed, stop and ask first, explaining why.
- If the spec is silent or ambiguous on a behaviour, ask rather than guess.
- Work one phase at a time (see "Build phases" in SPEC.md). Finish with `npm run build` passing.
- Explain progress and questions to the owner in Thai with correct Thai spelling; code, comments, commit messages and docs stay in English.

## Stack and commands

- React 18 + Vite 5 + TypeScript (strict), Tailwind 3, Dexie 4 (IndexedDB), react-router (HashRouter), vite-plugin-pwa, lucide-react icons, IBM Plex Sans Thai (bundled via @fontsource).
- `npm run dev` (serves on the LAN so the owner can open it on an iPhone), `npm run build`, `npm run preview`.

## Conventions

- Weights are stored in kg only; convert for display with `src/lib/units.ts`.
- Dates are local `YYYY-MM-DD` strings (`src/lib/dates.ts`); weeks start on Monday.
- Logs copy values when written, so later edits to programs, foods or exercises never change history.
- All UI text goes through `src/i18n/strings.ts` with both `th` and `en` entries.
- Category colours are competition-plate tokens in `src/index.css` and `tailwind.config.js`: weights red, running blue, other sports yellow, food green. Use the tokens, never raw hex in components.
- Touch targets at least 44 px; respect `env(safe-area-inset-*)`; everything must work offline.
- Changing the Dexie schema needs a new `db.version(n)` with an upgrade, never an edit to an existing version once released.
- Exercise images come from free-exercise-db (public domain). Keep the attribution in README.
