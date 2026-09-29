import type { SessionExercise, SetLog, WeightUnit } from '../db/types'
import { formatDuration } from './numbers'
import { toDisplayWeight } from './units'

/**
 * Reps (or seconds, for timed exercises) of a set, as one shared value or as a left and right side.
 * A set records whichever the exercise's mode was when it was logged, and an exercise can change
 * mode between sessions, so anything that reads a set works from what the set holds.
 */
export interface Sides { single?: number; left?: number; right?: number }

export const isTimedSet = (s: SetLog) =>
  s.durationSec !== undefined || s.durationLeftSec !== undefined || s.durationRightSec !== undefined

export const sidesOf = (s: SetLog, timed: boolean): Sides =>
  timed
    ? { single: s.durationSec, left: s.durationLeftSec, right: s.durationRightSec }
    : { single: s.reps, left: s.repsLeft, right: s.repsRight }

/** One value for both sides: the shared value, else the lower side (the weaker side decides). */
export function bothSides(x: Sides): number | undefined {
  if (x.single !== undefined) return x.single
  if (x.left !== undefined && x.right !== undefined) return Math.min(x.left, x.right)
  return x.left ?? x.right
}

/** Short text for a set: "60×8", "60×8/7", "+10×0:45"; a single value is shown as it was logged. */
export function setSummary(s: SetLog, se: Pick<SessionExercise, 'bodyweight' | 'timed'>, unit: WeightUnit) {
  const timed = isTimedSet(s) || (se.timed && s.reps === undefined && s.repsLeft === undefined && s.repsRight === undefined)
  const sd = sidesOf(s, timed)
  const v = (x?: number) => (x === undefined ? '–' : timed ? formatDuration(x) : String(x))
  const val = sd.single === undefined && (sd.left !== undefined || sd.right !== undefined)
    ? `${v(sd.left)}/${v(sd.right)}`
    : v(sd.single)
  if (s.weightKg === undefined) return timed ? val : `×${val}`
  const w = toDisplayWeight(s.weightKg, unit)
  return `${se.bodyweight || timed ? '+' : ''}${w}×${val}`
}
