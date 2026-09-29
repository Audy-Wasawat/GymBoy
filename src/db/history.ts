import { db } from './db'
import { copyOf, readSetValues, refreshBodyParts } from './sessions'
import type { Exercise, SessionExercise, SetDraft, SetLog, SetType, WeightUnit } from './types'
import { isPastOrToday } from '../lib/dates'
import { nextOrder } from './programs'

// Editing finished sessions. Rows added here are never stored as drafts, and deleting the last set
// of an exercise (or the last exercise of a session) removes it, so no empty exercise or session is left.

const tables = [db.sessions, db.sessionExercises, db.sets, db.setDrafts, db.exercises]

/** A session exercise shape for an exercise not yet in the session, so typed values can be validated. */
export const pendingSe = (ex: Exercise): SessionExercise => ({ ...copyOf(ex), sessionId: -1, order: 0 })

/** Moves a session to another date; every set carries the date too, so all of them move with it. */
export async function setSessionDate(sessionId: number, date: string) {
  if (!isPastOrToday(date)) return
  await db.transaction('rw', db.sessions, db.sessionExercises, db.sets, async () => {
    const seIds = (await db.sessionExercises.where('sessionId').equals(sessionId).primaryKeys()) as number[]
    await db.sets.where('sessionExerciseId').anyOf(seIds).modify({ date })
    await db.sessions.update(sessionId, { date })
  })
}

/**
 * Saves a row typed in the history screen. Creates the session (for a backdated one) and the
 * session exercise on the first saved set. Returns the ids, or undefined if the row is incomplete.
 */
export async function saveHistorySet(opts: {
  sessionId?: number; date: string
  /** The session exercise the row belongs to, or the exercise for one not in the session yet. */
  se?: SessionExercise; exercise?: Exercise
  row: Pick<SetDraft, 'weight' | 'value' | 'left' | 'right' | 'type' | 'toFailure' | 'order'>; unit: WeightUnit
}) {
  const se = opts.se ?? pendingSe(opts.exercise!)
  const values = readSetValues(opts.row, se, opts.unit)
  if (!values) return undefined
  return db.transaction('rw', tables, async () => {
    let sessionId = opts.sessionId
    if (sessionId === undefined) {
      const now = Date.now()
      sessionId = await db.sessions.add({ date: opts.date, bodyParts: [], startedAt: now, finishedAt: now })
    }
    const session = (await db.sessions.get(sessionId))!
    let seId = opts.se?.id
    if (seId === undefined) {
      const order = nextOrder(await db.sessionExercises.where('sessionId').equals(sessionId).toArray())
      seId = await db.sessionExercises.add({ ...copyOf(opts.exercise!), sessionId, order })
    }
    await db.sets.add({
      ...values, sessionExerciseId: seId, setNumber: opts.row.order, type: opts.row.type,
      exerciseId: se.exerciseId, date: session.date, toFailure: opts.row.toFailure
    })
    await refreshBodyParts(sessionId)
    return { sessionId, seId }
  })
}

export async function setSetType(set: SetLog, type: SetType, sessionId: number) {
  await db.transaction('rw', tables, async () => {
    await db.sets.update(set.id!, { type })
    await refreshBodyParts(sessionId)
  })
}

/** Deletes a set, then its exercise if now empty, then the session if now empty. Returns what went. */
export async function deleteHistorySet(set: SetLog, sessionId: number): Promise<'set' | 'exercise' | 'session'> {
  return db.transaction('rw', tables, async () => {
    await db.sets.delete(set.id!)
    if (await db.sets.where('sessionExerciseId').equals(set.sessionExerciseId).count()) {
      await refreshBodyParts(sessionId)
      return 'set'
    }
    await db.sessionExercises.delete(set.sessionExerciseId)
    return (await dropSessionIfEmpty(sessionId)) ? 'session' : 'exercise'
  })
}

export async function deleteHistoryExercise(se: SessionExercise): Promise<'exercise' | 'session'> {
  return db.transaction('rw', tables, async () => {
    await db.sets.where('sessionExerciseId').equals(se.id!).delete()
    await db.sessionExercises.delete(se.id!)
    return (await dropSessionIfEmpty(se.sessionId)) ? 'session' : 'exercise'
  })
}

async function dropSessionIfEmpty(sessionId: number) {
  if (await db.sessionExercises.where('sessionId').equals(sessionId).count()) {
    await refreshBodyParts(sessionId)
    return false
  }
  await db.sessions.delete(sessionId)
  return true
}
