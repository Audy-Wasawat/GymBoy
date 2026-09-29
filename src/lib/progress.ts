import { db } from '../db/db'
import type { Exercise, SessionExercise, SetLog, WorkoutSession } from '../db/types'

/**
 * What a set is measured by, for PRs and the progress chart:
 * - normal exercises: weight (left/right sides share it);
 * - bodyweight and timed exercises: the heaviest added weight if weight was ever added,
 *   otherwise reps (bodyweight) or duration (timed), taking the lower side for left/right.
 * Always worked out from the logged sets, never stored, so edits and deletes stay correct.
 */
export type MetricKind = 'weight' | 'added' | 'reps' | 'duration'

const lower = (a?: number, b?: number) => (a === undefined || b === undefined ? undefined : Math.min(a, b))

export const countOf = (s: SetLog, timed: boolean) =>
  timed ? s.durationSec ?? lower(s.durationLeftSec, s.durationRightSec) : s.reps ?? lower(s.repsLeft, s.repsRight)

export function metricKind(ex: Pick<Exercise, 'bodyweight' | 'timed'>, working: SetLog[]): MetricKind {
  if (!ex.bodyweight && !ex.timed) return 'weight'
  if (working.some((s) => (s.weightKg ?? 0) > 0)) return 'added'
  return ex.timed ? 'duration' : 'reps'
}

export function metricOf(kind: MetricKind, s: SetLog) {
  if (kind === 'weight') return s.weightKg
  if (kind === 'added') return s.weightKg !== undefined && s.weightKg > 0 ? s.weightKg : undefined
  return countOf(s, kind === 'duration')
}

export interface HistoryEntry { session: WorkoutSession; se: SessionExercise; working: SetLog[] }

export interface ExerciseProgress {
  kind: MetricKind
  /** Sessions with at least one working set of this exercise, oldest first. */
  entries: HistoryEntry[]
  /** Every working set that beat all earlier working sets (never in the exercise's first session). */
  prIds: Set<number>
  best?: { value: number; entry: HistoryEntry }
  /** One chart point per session: its best set. */
  points: { entry: HistoryEntry; value: number }[]
  /** Sessions left off the chart because none of their sets has the value being measured. */
  skipped: number
}

const chronological = (a: WorkoutSession, b: WorkoutSession) =>
  a.date.localeCompare(b.date) || a.startedAt - b.startedAt || a.id! - b.id!

export async function loadProgress(exerciseId: number): Promise<ExerciseProgress | undefined> {
  const ex = await db.exercises.get(exerciseId)
  if (!ex) return undefined
  const working = await db.sets.where('exerciseId').equals(exerciseId).filter((s) => s.type === 'working').toArray()
  const seIds = [...new Set(working.map((s) => s.sessionExerciseId))]
  const ses = (await db.sessionExercises.bulkGet(seIds)).filter((x): x is SessionExercise => !!x)
  const sessions = new Map(
    (await db.sessions.bulkGet([...new Set(ses.map((se) => se.sessionId))]))
      .filter((x): x is WorkoutSession => !!x).map((s) => [s.id!, s])
  )
  const entries: HistoryEntry[] = ses
    .filter((se) => sessions.has(se.sessionId))
    .map((se) => ({
      session: sessions.get(se.sessionId)!,
      se,
      working: working.filter((s) => s.sessionExerciseId === se.id).sort((a, b) => a.setNumber - b.setNumber)
    }))
    .sort((a, b) => chronological(a.session, b.session) || a.se.order - b.se.order)

  const kind = metricKind(ex, working)
  const prIds = new Set<number>()
  const points: ExerciseProgress['points'] = []
  let best: ExerciseProgress['best']
  let skipped = 0
  entries.forEach((entry, i) => {
    let top: number | undefined
    for (const s of entry.working) {
      const v = metricOf(kind, s)
      if (v === undefined) continue
      if (i > 0 && (!best || v > best.value)) prIds.add(s.id!)
      if (!best || v > best.value) best = { value: v, entry }
      if (top === undefined || v > top) top = v
    }
    if (top === undefined) skipped++
    else points.push({ entry, value: top })
  })
  return { kind, entries, prIds, best, points, skipped }
}

export interface WeightHint { top: number; timed: boolean; weightKg?: number }

/**
 * "Try adding weight": every working set of the previous session reached the top of the target
 * range that session had copied (both sides for left/right), with at least as many working sets as
 * targeted. Hidden once the current session has a saved working set heavier than last time.
 * It only informs; nothing is changed.
 */
export function weightHint(prev: { se: SessionExercise; sets: SetLog[] } | undefined, current: SetLog[]): WeightHint | undefined {
  if (!prev) return undefined
  const { se } = prev
  if (!se.targetSets || se.repMax === undefined) return undefined
  const working = prev.sets.filter((s) => s.type === 'working')
  if (working.length < se.targetSets) return undefined
  const sides = (s: SetLog) =>
    se.leftRight
      ? se.timed ? [s.durationLeftSec, s.durationRightSec] : [s.repsLeft, s.repsRight]
      : [se.timed ? s.durationSec : s.reps]
  if (!working.every((s) => sides(s).every((v) => v !== undefined && v >= se.repMax!))) return undefined
  const weights = working.map((s) => s.weightKg).filter((w): w is number => w !== undefined)
  const weightKg = weights.length ? Math.max(...weights) : undefined
  if (current.some((s) => s.type === 'working' && (s.weightKg ?? 0) > (weightKg ?? 0))) return undefined
  return { top: se.repMax, timed: se.timed, weightKg }
}
