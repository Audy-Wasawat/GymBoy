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
export const groupOf = (e: Exercise): LibraryGroup => e.bodyPart ?? 'mine'
