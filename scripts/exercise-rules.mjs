// Rules that turn free-exercise-db entries into Gymboy exercises automatically, for the entries
// that are not in the hand-picked list (scripts/exercise-picks.json). Names, equipment and muscles
// of the hand-picked ones are never touched by these rules.

export const BODY_PARTS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'quads', 'hamstrings', 'glutes', 'calves']

export const PART_OF_MUSCLE = {
  chest_upper: 'chest', chest_lower: 'chest',
  delt_front: 'shoulders', delt_side: 'shoulders', delt_rear: 'shoulders',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  abs: 'core', obliques: 'core',
  traps: 'back', lats: 'back', mid_back: 'back', lower_back: 'back',
  glutes: 'glutes', quads: 'quads', adductors: 'quads', hamstrings: 'hamstrings', calves: 'calves'
}

/** Only these source categories are used. Stretching, cardio, plyometrics, strongman and olympic lifts are not. */
export const CATEGORIES = new Set(['strength', 'powerlifting'])

/**
 * Left out on purpose: olympic lifts (the owner removed Power Clean), assisted variants (assist weight
 * is the opposite of the app's PR logic), foam rolling, and moves that need a partner.
 */
export function isExcluded(src) {
  const n = src.name
  if (src.equipment === 'foam roll') return 'foam roll'
  if (/(?<!squat )\bclean\b(?! grip)|\bsnatch\b|\bjerk\b/i.test(n)) return 'olympic lift'
  if (/assist/i.test(n)) return 'assisted'
  if (/manual/i.test(n)) return 'needs a partner'
  return undefined
}

export function equipmentOf(src) {
  if (/smith/i.test(src.id) || /smith/i.test(src.name)) return 'machine'
  switch (src.equipment) {
    case 'barbell': case 'e-z curl bar': return 'barbell'
    case 'dumbbell': return 'dumbbell'
    case 'cable': return 'cable'
    case 'machine': return 'machine'
    case 'body only': return 'bodyweight'
    case null: case undefined: return 'bodyweight' // the few strength entries without equipment are bodyweight moves
    default: return 'other' // kettlebells, bands, medicine ball, exercise ball, other
  }
}

const has = (re, s) => re.test(s)

/** Body-model regions for one coarse source muscle, using cues in the exercise name. */
function regions(muscle, name, ctx) {
  const n = name.toLowerCase()
  switch (muscle) {
    case 'chest':
      if (has(/incline/, n)) return ['chest_upper']
      if (has(/decline|dip/, n)) return ['chest_lower']
      return ['chest_upper', 'chest_lower']
    case 'shoulders':
      if (ctx.primaryIsBack && !ctx.asPrimary) return ['delt_rear'] // a pull uses the rear delts
      if (has(/rotation/, n)) return ['delt_rear']
      if (has(/rear|reverse fl|reverse machine|face pull|back flye|pull apart|bent.?over.*(raise|lateral|fly|flye)/, n)) return ['delt_rear']
      if (has(/lateral|side raise|side laterals/, n)) return ['delt_side']
      if (has(/upright/, n)) return ['delt_side']
      if (has(/front/, n)) return ['delt_front']
      if (has(/press|overhead|arnold|thruster|handstand|jammer|military|bradford|cuban|scaption/, n)) return ['delt_front', 'delt_side']
      return ctx.asPrimary ? ['delt_front', 'delt_side'] : ['delt_front']
    case 'lats':
      if (has(/\brow\b/, n) && !has(/pulldown|pull-up|chin/, n)) return ['lats', 'mid_back']
      return ['lats']
    case 'middle back':
      if (has(/chin|pull-?up|pulldown|muscle up|climb/, n)) return ['lats', 'mid_back']
      return ['mid_back', 'lats']
    case 'abdominals':
      if (has(/twist|oblique|side bend|windmill|wood.?chop|side jackknife|russian|pallof|judo|rotation|figure 8|bent press/, n)) return ['obliques', 'abs']
      return ['abs']
    case 'traps': return ['traps']
    case 'neck': return ['traps']
    case 'abductors': return ['glutes']
    case 'biceps': return ['biceps']
    case 'triceps': return ['triceps']
    case 'forearms': return ['forearms']
    case 'lower back': return ['lower_back']
    case 'glutes': return ['glutes']
    case 'quadriceps': return ['quads']
    case 'hamstrings': return ['hamstrings']
    case 'adductors': return ['adductors']
    case 'calves': return ['calves']
    default: throw new Error(`Unknown source muscle "${muscle}" in ${name}`)
  }
}

const unique = (xs) => [...new Set(xs)]

export function musclesOf(src) {
  const primaryIsBack = src.primaryMuscles.some((m) => m === 'lats' || m === 'middle back')
  let primary = unique(src.primaryMuscles.flatMap((m) => regions(m, src.name, { asPrimary: true, primaryIsBack })))
  // A deadlift or rack pull works the glutes and hamstrings as much as the lower back, like the hand-picked Deadlift.
  if (/deadlift|rack pull/i.test(src.name) && primary.includes('lower_back')) primary = unique([...primary, 'glutes', 'hamstrings'])
  const secondary = unique(src.secondaryMuscles.flatMap((m) => regions(m, src.name, { asPrimary: false, primaryIsBack })))
    .filter((m) => !primary.includes(m))
  return { primary, secondary }
}

/** Single-arm, single-leg, alternating and other one-sided moves. */
export const isLeftRight = (name, equipment) =>
  /single[- ]?(arm|leg)|one[- ]?(arm|leg)|one[- ]legged|alternat|unilateral|lunge|split squat|step[- ]?up|pistol|kickback|bulgarian|windmill|lying one|side bend|standing one/i.test(name) ||
  (equipment === 'dumbbell' && /concentration/i.test(name)) // a barbell concentration curl uses both hands

/** Holds and carries are logged as time. */
export const isTimed = (name) =>
  /plank|\bhold\b|carry|wall sit|dead hang|isometric|battling|balance|backward walk|\bwalk\b(?!ing lunge)/i.test(name) && !/monster|push.?up to/i.test(name)

/** Moves done with the body's own weight even when the source lists other kit (rings, bars, plates). */
export const isBodyweightMove = (name) =>
  /pull[- ]?up|chin|dips?\b|muscle[- ]up|push[- ]?up|sit[- ]?up|crunch|inverted|suspended|otis|bodyweight|hyperextension|leg pull-in|hip raise|leg lift|flutter|jackknife|cocoon|rope climb|london bridge|body-up|body tricep/i.test(name)

/** Turns one source entry into a Gymboy exercise (without an image). */
export function autoExercise(src) {
  const { primary, secondary } = musclesOf(src)
  if (primary.length === 0) throw new Error(`No primary muscle for ${src.id}`)
  const equipment = equipmentOf(src)
  return {
    key: src.id,
    name: src.name,
    equipment,
    bodyPart: PART_OF_MUSCLE[primary[0]],
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    leftRight: isLeftRight(src.name, equipment),
    timed: isTimed(src.name),
    // Rings, bars and plates are listed as "other"; those moves still use the body's own weight, so weight is optional.
    bodyweight: equipment === 'bodyweight' || (equipment === 'other' && isBodyweightMove(src.name))
  }
}
