// Builds the seeded exercise library from free-exercise-db (Unlicense / public domain).
//
//   node scripts/build-exercises.mjs --check   validate picks and print the list, write nothing
//   node scripts/build-exercises.mjs --no-images  write src/data/exercises.json only; entries get no image
//   node scripts/build-exercises.mjs           also write public/exercises/*.webp (needs sharp)
//
// Any pick whose id is missing from the source data stops the build; nothing is skipped silently.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const res = await fetch(`${source}/dist/exercises.json`)
if (!res.ok) throw new Error(`Could not download source data: HTTP ${res.status}`)
const byId = new Map((await res.json()).map((e) => [e.id, e]))

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

if (errors.length) {
  console.error(`Stopped: ${errors.length} problem(s) in scripts/exercise-picks.json`)
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
  console.log(`\nTotal: ${out.length}`)
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
