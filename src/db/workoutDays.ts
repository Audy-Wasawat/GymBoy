import { db } from './db'
import type { WorkoutSession } from './types'

/**
 * A session counts as a workout only once it has at least one saved set (any type). A session that
 * was just started, or holds only unsaved drafts, is not a workout: it is not listed, not counted
 * as a workout day and does not colour the activity grid. Today, Summary and the grid all use this.
 */
export async function withSavedSets(sessions: WorkoutSession[]): Promise<WorkoutSession[]> {
  if (sessions.length === 0) return []
  const ses = await db.sessionExercises.where('sessionId').anyOf(sessions.map((s) => s.id!)).toArray()
  const sessionOf = new Map(ses.map((se) => [se.id!, se.sessionId]))
  const counted = new Set<number>()
  await db.sets.where('sessionExerciseId').anyOf([...sessionOf.keys()]).each((s) => {
    counted.add(sessionOf.get(s.sessionExerciseId)!)
  })
  return sessions.filter((s) => counted.has(s.id!))
}

/** Workout sessions (see withSavedSets) with a date in [from, to]; either bound may be left out. */
export async function workoutSessions(from?: string, to?: string): Promise<WorkoutSession[]> {
  const all = from !== undefined && to !== undefined
    ? await db.sessions.where('date').between(from, to, true, true).toArray()
    : from !== undefined
      ? await db.sessions.where('date').aboveOrEqual(from).toArray()
      : await db.sessions.toArray()
  return withSavedSets(all)
}
