import type { BodyPart, Equipment, Exercise, Muscle } from '../db/types'

export const BODY_PARTS: BodyPart[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'quads', 'hamstrings', 'glutes', 'calves'
]

export const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other']

/** Body-model regions in picker order, front of the body first. */
export const MUSCLES: Muscle[] = [
  'chest_upper', 'chest_lower', 'delt_front', 'delt_side', 'delt_rear', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'quads', 'adductors', 'traps', 'lats', 'mid_back', 'lower_back', 'glutes', 'hamstrings', 'calves'
]

/** Group id for the library: a body part, or 'mine' for custom exercises without one. */
export type LibraryGroup = BodyPart | 'mine'

/** Which body part a muscle region belongs to. */
export const PART_OF_MUSCLE: Record<Muscle, BodyPart> = {
  chest_upper: 'chest', chest_lower: 'chest',
  delt_front: 'shoulders', delt_side: 'shoulders', delt_rear: 'shoulders',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  abs: 'core', obliques: 'core',
  traps: 'back', lats: 'back', mid_back: 'back', lower_back: 'back',
  glutes: 'glutes', quads: 'quads', adductors: 'quads', hamstrings: 'hamstrings', calves: 'calves'
}

/**
 * The body part of an exercise: the one set on it, else the one of its first primary muscle,
 * else 'mine'. Worked out on read (nothing is stored), so it follows later edits to the muscles.
 */
export function bodyPartOf(e: Pick<Exercise, 'bodyPart' | 'primaryMuscles'>): LibraryGroup {
  if (e.bodyPart) return e.bodyPart
  const first = e.primaryMuscles?.[0]
  return first ? PART_OF_MUSCLE[first] : 'mine'
}

/** Library group of an exercise (see bodyPartOf). */
export const groupOf = (e: Pick<Exercise, 'bodyPart' | 'primaryMuscles'>): LibraryGroup => bodyPartOf(e)
