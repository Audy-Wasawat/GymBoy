// Builds the seeded exercise library from free-exercise-db (Unlicense / public domain).
//
//   node scripts/build-exercises.mjs --check   validate picks and print the list, write nothing
//   node scripts/build-exercises.mjs --no-images  write src/data/exercises.json only; entries get no image
//   node scripts/build-exercises.mjs           also write public/exercises/*.webp (needs sharp)
//   add --source-file=path/to/exercises.json to read a saved copy of the source's dist/exercises.json
//   instead of downloading it (the data must be the pinned commit named in exercise-picks.json)
//
// Any pick whose id is missing from the source data stops the build; nothing is skipped silently.
//
// The library is, in this order:
//   1. the hand-picked exercises in scripts/exercise-picks.json (their keys, muscles and order never change),
//   2. every other strength / powerlifting entry of the source data, converted by scripts/exercise-rules.mjs,
//   3. exercises the source lacks, in scripts/extra-exercises.json (seed keys start with "extra-").
// Seeding only adds keys that are missing, so existing installs keep their rows untouched.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { autoExercise, CATEGORIES, isExcluded, PART_OF_MUSCLE } from './exercise-rules.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const noImages = process.argv.includes('--no-images')

const MUSCLES = new Set([
  'chest_upper', 'chest_lower', 'delt_front', 'delt_side', 'delt_rear', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'traps', 'lats', 'mid_back', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves'
])
const BODY_PARTS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'quads', 'hamstrings', 'glutes', 'calves']
const EQUIPMENT = new Set(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'])

/** Coarse free-exercise-db muscle names to body-model regions. Chest and shoulders are refined per pick. */
const COARSE = {
  abdominals: ['abs'], biceps: ['biceps'], triceps: ['triceps'], forearms: ['forearms'], traps: ['traps'],
  lats: ['lats'], 'middle back': ['mid_back'], 'lower back': ['lower_back'], glutes: ['glutes'],
  quadriceps: ['quads'], hamstrings: ['hamstrings'], adductors: ['adductors'], abductors: ['glutes'],
  calves: ['calves'], chest: ['chest_upper', 'chest_lower'], neck: []
}

function mapMuscles(names, pulling) {
  return names.flatMap((m) => {
    if (m === 'shoulders') return [pulling ? 'delt_rear' : 'delt_front']
    if (!(m in COARSE)) throw new Error(`Unknown source muscle "${m}"`)
    return COARSE[m]
  })
}

function mapEquipment(src) {
  if (/smith/i.test(src.id)) return 'machine'
  switch (src.equipment) {
    case 'barbell': case 'e-z curl bar': return 'barbell'
    case 'dumbbell': return 'dumbbell'
    case 'cable': return 'cable'
    case 'machine': return 'machine'
    case 'body only': return 'bodyweight'
    default: return 'other'
  }
}

const unique = (xs) => [...new Set(xs)]

const { source, picks } = JSON.parse(await readFile(join(root, 'scripts/exercise-picks.json'), 'utf8'))
const sourceFile = process.argv.find((a) => a.startsWith('--source-file='))?.slice('--source-file='.length)
let sourceData
if (sourceFile) {
  sourceData = JSON.parse(await readFile(sourceFile, 'utf8'))
} else {
  const res = await fetch(`${source}/dist/exercises.json`)
  if (!res.ok) throw new Error(`Could not download source data: HTTP ${res.status}`)
  sourceData = await res.json()
}
const byId = new Map(sourceData.map((e) => [e.id, e]))

const errors = []
const seenKeys = new Set()
const out = []
for (const p of picks) {
  const key = p.key ?? p.id
  const src = byId.get(p.id)
  if (!src) { errors.push(`id not found in source: ${p.id}`); continue }
  if (seenKeys.has(key)) errors.push(`duplicate key: ${key}`)
  seenKeys.add(key)
  if (!p.name) errors.push(`${key}: missing name`)
  if (!BODY_PARTS.includes(p.bodyPart)) errors.push(`${key}: bad bodyPart "${p.bodyPart}"`)
  const imageIndex = p.imageIndex ?? 0
  if (!src.images[imageIndex]) errors.push(`${key}: no image at index ${imageIndex}`)

  const equipment = p.equipment ?? mapEquipment(src)
  if (!EQUIPMENT.has(equipment)) errors.push(`${key}: bad equipment "${equipment}"`)
  const pulling = src.primaryMuscles.some((m) => m === 'lats' || m === 'middle back')
  const primary = unique(p.primary ?? mapMuscles(src.primaryMuscles, pulling))
  const secondary = unique(p.secondary ?? mapMuscles(src.secondaryMuscles, pulling)).filter((m) => !primary.includes(m))
  for (const m of [...primary, ...secondary]) if (!MUSCLES.has(m)) errors.push(`${key}: bad muscle "${m}"`)

  out.push({
    key, name: p.name, equipment, bodyPart: p.bodyPart,
    image: noImages ? undefined : `exercises/${key.toLowerCase()}.webp`,
    primaryMuscles: primary, secondaryMuscles: secondary,
    leftRight: p.leftRight ?? false,
    timed: p.timed ?? false,
    bodyweight: p.bodyweight ?? equipment === 'bodyweight',
    sourceImage: src.images[imageIndex]
  })
}

// 2. The rest of the source data, converted by rule.
const pickedIds = new Set(picks.map((p) => p.id))
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const usedNames = new Set(out.map((e) => norm(e.name)))
const excluded = []
const auto = []
for (const src of [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  if (!CATEGORIES.has(src.category) || pickedIds.has(src.id)) continue
  const why = isExcluded(src)
  if (why) { excluded.push(`${src.id}: ${why}`); continue }
  const e = autoExercise(src)
  // A name already taken gets its equipment added, so no two exercises share a name.
  if (usedNames.has(norm(e.name))) e.name = `${e.name} (${e.equipment})`
  if (usedNames.has(norm(e.name))) { errors.push(`name clash: ${e.name}`); continue }
  usedNames.add(norm(e.name))
  auto.push(e)
}
out.push(...auto)

// 3. Exercises the source lacks.
const extras = JSON.parse(await readFile(join(root, 'scripts/extra-exercises.json'), 'utf8'))
for (const x of extras) {
  if (!x.key?.startsWith('extra-')) errors.push(`extra key must start with "extra-": ${x.key}`)
  if (seenKeys.has(x.key) || out.some((e) => e.key === x.key)) errors.push(`duplicate key: ${x.key}`)
  if (usedNames.has(norm(x.name))) { errors.push(`extra duplicates an existing name: ${x.name}`); continue }
  usedNames.add(norm(x.name))
  if (!EQUIPMENT.has(x.equipment)) errors.push(`${x.key}: bad equipment "${x.equipment}"`)
  for (const m of [...x.primary, ...(x.secondary ?? [])]) if (!MUSCLES.has(m)) errors.push(`${x.key}: bad muscle "${m}"`)
  if (!x.primary?.length) errors.push(`${x.key}: needs a primary muscle`)
  out.push({
    key: x.key, name: x.name, equipment: x.equipment,
    bodyPart: x.bodyPart ?? PART_OF_MUSCLE[x.primary[0]],
    image: undefined,
    primaryMuscles: x.primary, secondaryMuscles: x.secondary ?? [],
    leftRight: x.leftRight ?? false, timed: x.timed ?? false,
    bodyweight: x.bodyweight ?? x.equipment === 'bodyweight'
  })
}

if (errors.length) {
  console.error(`Stopped: ${errors.length} problem(s) in the exercise sources`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

if (checkOnly) {
  for (const part of BODY_PARTS) {
    const rows = out.filter((e) => e.bodyPart === part)
    console.log(`\n### ${part} (${rows.length})\n`)
    console.log('| # | Name | Equipment | L/R | Timed | Primary | Secondary |\n| ---: | --- | --- | :---: | :---: | --- | --- |')
    rows.forEach((e, i) => console.log(
      `| ${i + 1} | ${e.name} | ${e.equipment}${e.bodyweight && e.equipment !== 'bodyweight' ? ' (bw)' : ''} | ${e.leftRight ? 'L/R' : ''} | ${e.timed ? 'timed' : ''} | ${e.primaryMuscles.join(', ')} | ${e.secondaryMuscles.join(', ')} |`
    ))
  }
  console.log(`\nTotal: ${out.length} (${picks.length} picked, ${auto.length} by rule, ${extras.length} extra)`)
  console.log(`Excluded from the source data: ${excluded.length}`)
  for (const e of excluded) console.log(`  - ${e}`)
  process.exit(0)
}

let bytes = 0
if (!noImages) {
  const { default: sharp } = await import('sharp')
  await mkdir(join(root, 'public/exercises'), { recursive: true })
  for (const e of out) {
    const img = await fetch(`${source}/exercises/${e.sourceImage}`)
    if (!img.ok) throw new Error(`Could not download image for ${e.key}: HTTP ${img.status}`)
    const webp = await sharp(Buffer.from(await img.arrayBuffer()))
      .resize({ width: 360, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer()
    bytes += webp.length
    await writeFile(join(root, 'public', e.image), webp)
  }
}

await mkdir(join(root, 'src/data'), { recursive: true })
const data = out.map(({ sourceImage, ...rest }) => rest)
await writeFile(join(root, 'src/data/exercises.json'), JSON.stringify(data, null, 1) + '\n')
console.log(`Wrote ${data.length} exercises` + (noImages ? ' without images' : `, images ${(bytes / 1024 / 1024).toFixed(2)} MB`))
