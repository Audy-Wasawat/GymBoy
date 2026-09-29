// Audits the built library (src/data/exercises.json): how many exercises train each muscle region
// per equipment type, and whether each main movement family exists in enough equipment types.
//
//   node scripts/audit-exercises.mjs            print the matrix, the families and a 30-exercise spot check
//   node scripts/audit-exercises.mjs --md       print the matrix and gaps as markdown (for DECISIONS.md)
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(await readFile(join(root, 'src/data/exercises.json'), 'utf8'))
const md = process.argv.includes('--md')

const REGIONS = [
  'chest_upper', 'chest_lower', 'delt_front', 'delt_side', 'delt_rear', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'traps', 'lats', 'mid_back', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves'
]
const EQUIP = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other']
const MIN_PER_REGION = 10
const MIN_EQUIPMENT_TYPES = 3

const pad = (s, n) => String(s).padEnd(n)
const gaps = []

// --- Matrix: exercises where the region is a primary muscle.
const rows = REGIONS.map((r) => {
  const counts = EQUIP.map((eq) => data.filter((e) => e.equipment === eq && e.primaryMuscles.includes(r)).length)
  const total = data.filter((e) => e.primaryMuscles.includes(r)).length
  if (total < MIN_PER_REGION) gaps.push(`${r}: only ${total} exercises (target ${MIN_PER_REGION})`)
  return { r, counts, total }
})
if (md) {
  console.log(`| Region | ${EQUIP.join(' | ')} | Total |\n| --- | ${EQUIP.map(() => '---:').join(' | ')} | ---: |`)
  for (const { r, counts, total } of rows) console.log(`| ${r} | ${counts.join(' | ')} | ${total} |`)
} else {
  console.log(`\nPrimary-muscle matrix (${data.length} exercises)\n`)
  console.log(pad('region', 13) + EQUIP.map((e) => pad(e, 11)).join('') + 'total')
  for (const { r, counts, total } of rows) console.log(pad(r, 13) + counts.map((c) => pad(c, 11)).join('') + total + (total < MIN_PER_REGION ? '   <-- below target' : ''))
}

// --- Movement families: name pattern plus, where it matters, the muscles they train.
const primaryIn = (e, ...ms) => e.primaryMuscles.some((m) => ms.includes(m))
const FAMILIES = [
  ['curl (biceps)', (e) => /curl/i.test(e.name) && primaryIn(e, 'biceps') && !/wrist/i.test(e.name)],
  ['chest press', (e) => /press|bench/i.test(e.name) && primaryIn(e, 'chest_upper', 'chest_lower') && !/leg/i.test(e.name)],
  ['shoulder press', (e) => /press/i.test(e.name) && primaryIn(e, 'delt_front', 'delt_side') && !/leg|bench|chest|calf/i.test(e.name)],
  ['row', (e) => /\brows?\b/i.test(e.name) && primaryIn(e, 'mid_back', 'lats') && !/upright|rear delt/i.test(e.name)],
  ['lateral / front raise', (e) => /raise/i.test(e.name) && primaryIn(e, 'delt_side', 'delt_front') && !/calf|leg|knee|hip/i.test(e.name)],
  ['triceps extension / pushdown', (e) => /extension|pushdown|kickback|skull|press.?down/i.test(e.name) && primaryIn(e, 'triceps')],
  ['leg extension (knee extension)', (e) => /leg extension|reverse nordic|sissy/i.test(e.name)],
  ['pulldown / pull-up', (e) => /pulldown|pull-?up|chin/i.test(e.name) && primaryIn(e, 'lats', 'mid_back')],
  ['squat', (e) => /squat/i.test(e.name) && primaryIn(e, 'quads', 'glutes') && !/jump/i.test(e.name)],
  ['lunge / split squat', (e) => /lunge|split squat|step-?up/i.test(e.name)],
  ['deadlift / hip hinge', (e) => /deadlift|good ?morning|hyperextension|back extension|pull-?through|hip hinge|swing/i.test(e.name)],
  ['crunch / leg raise', (e) => /crunch|leg raise|knee raise|sit-?up|leg pull-?in|hip raise/i.test(e.name) && primaryIn(e, 'abs', 'obliques')],
  ['calf raise', (e) => primaryIn(e, 'calves') && /raise|press|calf/i.test(e.name)],
  ['hip thrust / glute bridge', (e) => /hip thrust|glute bridge|hip lift|kickback/i.test(e.name) && primaryIn(e, 'glutes')],
  ['leg curl (hamstring curl)', (e) => /leg curl|hamstring curl|nordic hamstring/i.test(e.name)],
  ['fly / crossover', (e) => /fl(y|ye|yes)|crossover|pec deck|butterfly/i.test(e.name) && primaryIn(e, 'chest_upper', 'chest_lower', 'delt_rear')],
  ['shrug', (e) => /shrug/i.test(e.name)],
  ['rotation / twist', (e) => /twist|rotation|wood.?chop|pallof/i.test(e.name) && primaryIn(e, 'obliques', 'abs')]
]
if (md) console.log(`\n| Family | ${EQUIP.join(' | ')} | Types |\n| --- | ${EQUIP.map(() => '---:').join(' | ')} | ---: |`)
else console.log('\nMovement families (exercises per equipment type)\n' + pad('family', 30) + EQUIP.map((e) => pad(e, 11)).join('') + 'types')
for (const [name, test] of FAMILIES) {
  const counts = EQUIP.map((eq) => data.filter((e) => e.equipment === eq && test(e)).length)
  const types = counts.filter((c) => c > 0).length
  if (types < MIN_EQUIPMENT_TYPES) gaps.push(`family "${name}": only ${types} equipment type(s): ${EQUIP.filter((_, i) => counts[i] > 0).join(', ') || 'none'}`)
  if (md) console.log(`| ${name} | ${counts.join(' | ')} | ${types} |`)
  else console.log(pad(name, 30) + counts.map((c) => pad(c, 11)).join('') + types + (types < MIN_EQUIPMENT_TYPES ? '   <-- below target' : ''))
}

// --- Duplicates.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const seen = new Map()
const dupes = []
for (const e of data) {
  const k = norm(e.name)
  if (seen.has(k)) dupes.push(`${e.name} (${e.key}) = ${seen.get(k)}`)
  else seen.set(k, `${e.name} (${e.key})`)
}
const keys = new Set()
for (const e of data) {
  if (keys.has(e.key)) dupes.push(`duplicate key ${e.key}`)
  keys.add(e.key)
}

console.log(`\nDuplicates: ${dupes.length}`)
for (const d of dupes) console.log(`  - ${d}`)
console.log(`\nGaps: ${gaps.length}`)
for (const g of gaps) console.log(`  - ${g}`)

// --- A repeatable spot check of 30 exercises that are not hand-picked.
if (!md) {
  let seed = 20260930
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  const pool = data.slice(249) // everything after the hand-picked ones
  const picked = new Set()
  while (picked.size < Math.min(30, pool.length)) picked.add(Math.floor(rand() * pool.length))
  console.log('\nSpot check (name | equipment | L/R | timed | primary | secondary)')
  for (const i of [...picked].sort((a, b) => a - b)) {
    const e = pool[i]
    console.log(`${e.name} | ${e.equipment}${e.bodyweight && e.equipment !== 'bodyweight' ? ' (bw)' : ''} | ${e.leftRight ? 'L/R' : '-'} | ${e.timed ? 'timed' : '-'} | ${e.primaryMuscles.join(',')} | ${e.secondaryMuscles.join(',')}`)
  }
}
if (gaps.length || dupes.length) process.exitCode = 1
