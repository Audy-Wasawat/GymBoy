import { db } from './db'
import { nextOrder } from './programs'
import type { BodyPart, Exercise, SessionExercise, SetDraft, SetLog, SetType, WeightUnit } from './types'
import { localDate } from '../lib/dates'
import { BODY_PARTS, bodyPartOf } from '../lib/exercises'
import { formatDuration, parseCount, parseDecimal, parseDuration } from '../lib/numbers'
import { bothSides, sidesOf } from '../lib/setFormat'
import { fromDisplayWeight, toDisplayWeight } from '../lib/units'

// At most one session is open; finishedAt is a number, so the open one is found with a filter.
export const getOpenSession = () => db.sessions.filter((s) => !s.finishedAt).first()

export const copyOf = (ex: Exercise) => ({
  exerciseId: ex.id!, name: ex.name, equipment: ex.equipment,
  leftRight: ex.leftRight, bodyweight: ex.bodyweight, timed: ex.timed
})

export const emptyDraft = (sessionExerciseId: number, order: number, type: SetType = 'working'): SetDraft => ({
  sessionExerciseId, order, type, weight: '', value: '', left: '', right: '', toFailure: false
})

export const isDraftEmpty = (d: SetDraft) =>
  !d.weight.trim() && !d.value.trim() && !d.left.trim() && !d.right.trim() && !d.toFailure

/** Starts a session for today from a day of the active program, or an empty one. */
export async function startSession(dayId?: number) {
  return db.transaction('rw', [db.sessions, db.sessionExercises, db.setDrafts, db.programDays, db.programExercises, db.exercises], async () => {
    const open = await getOpenSession()
    if (open) return open.id!
    const day = dayId === undefined ? undefined : await db.programDays.get(dayId)
    const sessionId = await db.sessions.add({
      date: localDate(), programId: day?.programId, dayName: day?.name, bodyParts: [], startedAt: Date.now()
    })
    if (day) {
      const rows = await db.programExercises.where('dayId').equals(day.id!).sortBy('order')
      let order = 0
      for (const pe of rows) {
        const ex = await db.exercises.get(pe.exerciseId)
        if (!ex) continue
        const seId = await db.sessionExercises.add({
          ...copyOf(ex), sessionId, order: order++,
          targetSets: pe.targetSets, repMin: pe.repMin, repMax: pe.repMax, restSec: pe.restSec
        })
        await db.setDrafts.bulkAdd(Array.from({ length: pe.targetSets }, (_, i) => emptyDraft(seId, i)))
      }
    }
    return sessionId
  })
}

export async function addExerciseToSession(sessionId: number, ex: Exercise) {
  await db.transaction('rw', db.sessionExercises, db.setDrafts, async () => {
    const order = nextOrder(await db.sessionExercises.where('sessionId').equals(sessionId).toArray())
    const seId = await db.sessionExercises.add({ ...copyOf(ex), sessionId, order })
    await db.setDrafts.add(emptyDraft(seId, 0))
  })
}

/** Swaps the exercise of a row that has no saved sets yet; targets from the program are kept. */
export async function replaceSessionExercise(seId: number, ex: Exercise) {
  await db.sessionExercises.update(seId, copyOf(ex))
}

export async function removeSessionExercise(se: SessionExercise) {
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.setDrafts, db.exercises], async () => {
    await db.sets.where('sessionExerciseId').equals(se.id!).delete()
    await db.setDrafts.where('sessionExerciseId').equals(se.id!).delete()
    await db.sessionExercises.delete(se.id!)
    await refreshBodyParts(se.sessionId)
  })
}

/** Deletes an open session with everything logged in it. */
export async function cancelSession(sessionId: number) {
  await db.transaction('rw', db.sessions, db.sessionExercises, db.sets, db.setDrafts, async () => {
    const seIds = (await db.sessionExercises.where('sessionId').equals(sessionId).primaryKeys()) as number[]
    await db.sets.where('sessionExerciseId').anyOf(seIds).delete()
    await db.setDrafts.where('sessionExerciseId').anyOf(seIds).delete()
    await db.sessionExercises.bulkDelete(seIds)
    await db.sessions.delete(sessionId)
  })
}

/** Body parts of the exercises that have at least one saved working set. */
export async function refreshBodyParts(sessionId: number) {
  const ses = await db.sessionExercises.where('sessionId').equals(sessionId).toArray()
  const parts = new Set<BodyPart>()
  for (const se of ses) {
    const worked = await db.sets.where('sessionExerciseId').equals(se.id!).filter((s) => s.type === 'working').count()
    if (!worked) continue
    const ex = await db.exercises.get(se.exerciseId)
    const part = ex ? bodyPartOf(ex) : undefined
    if (part && part !== 'mine') parts.add(part)
  }
  await db.sessions.update(sessionId, { bodyParts: BODY_PARTS.filter((p) => parts.has(p)) })
}

/**
 * Works every session's body parts out again from the exercises as they are now. A custom
 * exercise's body part comes from its muscles, so editing an exercise (or an older session that
 * predates this rule) must not leave a stale label. Only sessions whose value changes are written.
 */
export async function recomputeAllBodyParts() {
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.exercises], async () => {
    const [sessions, ses, exercises] = await Promise.all([
      db.sessions.toArray(), db.sessionExercises.toArray(), db.exercises.toArray()
    ])
    const withWorking = new Set<number>()
    await db.sets.filter((s) => s.type === 'working').each((s) => withWorking.add(s.sessionExerciseId))
    const partOf = new Map(exercises.map((e) => [e.id!, bodyPartOf(e)]))
    const bySession = new Map<number, Set<BodyPart>>()
    for (const se of ses) {
      if (!withWorking.has(se.id!)) continue
      const part = partOf.get(se.exerciseId)
      if (!part || part === 'mine') continue
      if (!bySession.has(se.sessionId)) bySession.set(se.sessionId, new Set())
      bySession.get(se.sessionId)!.add(part)
    }
    for (const s of sessions) {
      const next = BODY_PARTS.filter((p) => bySession.get(s.id!)?.has(p))
      if (next.join() !== (s.bodyParts ?? []).join()) await db.sessions.update(s.id!, { bodyParts: next })
    }
  })
}

type SetValues = Pick<SetLog, 'weightKg' | 'reps' | 'repsLeft' | 'repsRight' | 'durationSec' | 'durationLeftSec' | 'durationRightSec'>

/** Reads typed text into set values, or undefined when something required is missing or invalid. */
export function readSetValues(
  text: Pick<SetDraft, 'weight' | 'value' | 'left' | 'right'>, se: SessionExercise, unit: WeightUnit
): SetValues | undefined {
  const w = parseDecimal(text.weight)
  if (text.weight.trim() && w === undefined) return undefined
  // Weight may be left empty only for bodyweight and timed exercises (then it is optional added load).
  if (w === undefined && !se.bodyweight && !se.timed) return undefined
  const weightKg = w === undefined ? undefined : fromDisplayWeight(w, unit)
  const read = se.timed ? parseDuration : parseCount
  if (se.leftRight) {
    const l = read(text.left)
    const r = read(text.right)
    if (l === undefined || r === undefined) return undefined
    return se.timed ? { weightKg, durationLeftSec: l, durationRightSec: r } : { weightKg, repsLeft: l, repsRight: r }
  }
  const v = read(text.value)
  if (v === undefined) return undefined
  return se.timed ? { weightKg, durationSec: v } : { weightKg, reps: v }
}

/** Set values back to the text shown in the inputs, in the chosen weight unit. */
export function setToText(s: SetValues, se: SessionExercise, unit: WeightUnit) {
  const n = (x?: number) => (x === undefined ? '' : se.timed ? formatDuration(x) : String(x))
  const sd = sidesOf(s as SetLog, se.timed)
  // The set may have been logged in the other mode: a single value fills both sides, and two sides
  // become the lower one, so copying "previous" never leaves an empty field.
  return {
    weight: s.weightKg === undefined ? '' : String(toDisplayWeight(s.weightKg, unit)),
    value: se.leftRight ? '' : n(bothSides(sd)),
    left: se.leftRight ? n(sd.left ?? sd.single) : '',
    right: se.leftRight ? n(sd.right ?? sd.single) : ''
  }
}

/**
 * Switches an exercise of the open session between one shared value and left/right. Allowed only
 * while it has no saved set. The choice is also kept as the exercise's default, so the next session
 * starts in the mode last used. Typed rows are converted so nothing typed is lost.
 * Returns false when it was refused.
 */
export async function setSessionLeftRight(seId: number, on: boolean): Promise<boolean> {
  return db.transaction('rw', [db.sessionExercises, db.sets, db.setDrafts, db.exercises], async () => {
    const se = await db.sessionExercises.get(seId)
    if (!se) return false
    if (await db.sets.where('sessionExerciseId').equals(seId).count()) return false
    if (se.leftRight === on) return true
    await db.sessionExercises.update(seId, { leftRight: on })
    await db.exercises.update(se.exerciseId, { leftRight: on })
    const read = se.timed ? parseDuration : parseCount
    const lower = (a: string, b: string) => {
      const x = read(a); const y = read(b)
      return x !== undefined && y !== undefined ? (x <= y ? a : b) : a || b
    }
    for (const d of await db.setDrafts.where('sessionExerciseId').equals(seId).toArray()) {
      await db.setDrafts.update(d.id!, on
        ? { left: d.left || d.value, right: d.right || d.value, value: '' }
        : { value: d.value || lower(d.left, d.right), left: '', right: '' })
    }
    return true
  })
}

/** Turns a draft into a saved set. Returns false when the draft is incomplete. */
export async function saveDraft(draft: SetDraft, se: SessionExercise, unit: WeightUnit, date: string) {
  const values = readSetValues(draft, se, unit)
  if (!values) return false
  return db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.setDrafts, db.exercises], async () => {
    // A second call for the same draft (double tap) finds it already gone and adds nothing.
    if (!(await db.setDrafts.get(draft.id!))) return false
    await db.sets.add({
      ...values, sessionExerciseId: se.id!, setNumber: draft.order, type: draft.type,
      exerciseId: se.exerciseId, date, toFailure: draft.toFailure
    })
    await db.setDrafts.delete(draft.id!)
    await refreshBodyParts(se.sessionId)
    return true
  })
}

export async function deleteSet(set: SetLog, sessionId: number) {
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.exercises], async () => {
    await db.sets.delete(set.id!)
    await refreshBodyParts(sessionId)
  })
}

/**
 * What finishing would do: drafts with something typed, how many of them are complete, saved sets,
 * and the exercises that would be left without sets (and so removed) if drafts are kept or discarded.
 */
export async function finishPreview(sessionId: number, unit: WeightUnit) {
  const ses = await db.sessionExercises.where('sessionId').equals(sessionId).toArray()
  const byId = new Map(ses.map((se) => [se.id!, se]))
  const drafts = (await db.setDrafts.where('sessionExerciseId').anyOf([...byId.keys()]).toArray()).filter((d) => !isDraftEmpty(d))
  const complete = drafts.filter((d) => readSetValues(d, byId.get(d.sessionExerciseId)!, d.unit ?? unit))
  const sets = await db.sets.where('sessionExerciseId').anyOf([...byId.keys()]).toArray()
  const withSets = new Set(sets.map((s) => s.sessionExerciseId))
  const withCompleteDrafts = new Set(complete.map((d) => d.sessionExerciseId))
  return {
    typedDrafts: drafts.length, completeDrafts: complete.length, savedSets: sets.length,
    emptyIfDiscard: ses.filter((se) => !withSets.has(se.id!)).map((se) => se.name),
    emptyIfKeep: ses.filter((se) => !withSets.has(se.id!) && !withCompleteDrafts.has(se.id!)).map((se) => se.name)
  }
}

/**
 * Finishes the session. With keepDrafts, complete drafts become saved sets; every draft is then removed.
 * Exercises left without sets are removed, and a session left with no sets is deleted, since nothing
 * was logged (the UI asks first in both cases).
 */
export async function finishSession(sessionId: number, keepDrafts: boolean, unit: WeightUnit) {
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.sets, db.setDrafts, db.exercises], async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) return
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).toArray()
    const seIds = ses.map((se) => se.id!)
    if (keepDrafts) {
      for (const se of ses) {
        const drafts = await db.setDrafts.where('sessionExerciseId').equals(se.id!).toArray()
        for (const d of drafts) {
          const values = isDraftEmpty(d) ? undefined : readSetValues(d, se, d.unit ?? unit)
          if (values) {
            await db.sets.add({
              ...values, sessionExerciseId: se.id!, setNumber: d.order, type: d.type,
              exerciseId: se.exerciseId, date: session.date, toFailure: d.toFailure
            })
          }
        }
      }
    }
    await db.setDrafts.where('sessionExerciseId').anyOf(seIds).delete()
    const withSets = new Set((await db.sets.where('sessionExerciseId').anyOf(seIds).toArray()).map((s) => s.sessionExerciseId))
    await db.sessionExercises.bulkDelete(seIds.filter((id) => !withSets.has(id)))
    if (withSets.size === 0) {
      await db.sessions.delete(sessionId)
      return
    }
    await refreshBodyParts(sessionId)
    await db.sessions.update(sessionId, { finishedAt: Date.now(), restEndsAt: undefined, restTotalSec: undefined })
  })
}

/** The most recent other session with this exercise: its copied targets and its working sets in set order. */
export async function previousEntry(exerciseId: number, currentSessionId: number): Promise<{ se: SessionExercise; sets: SetLog[] } | undefined> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).filter((s) => s.type === 'working').toArray()
  const seIds = [...new Set(sets.map((s) => s.sessionExerciseId))]
  const ses = await db.sessionExercises.bulkGet(seIds)
  let best: { se: SessionExercise; date: string } | undefined
  ses.forEach((se, i) => {
    if (!se || se.sessionId === currentSessionId) return
    const date = sets.find((s) => s.sessionExerciseId === seIds[i])!.date
    if (!best || date > best.date || (date === best.date && se.id! > best.se.id!)) best = { se, date }
  })
  if (!best) return undefined
  const se = best.se
  return { se, sets: sets.filter((s) => s.sessionExerciseId === se.id).sort((a, b) => a.setNumber - b.setNumber) }
}

export const startRest = (sessionId: number, sec: number) =>
  db.sessions.update(sessionId, { restEndsAt: Date.now() + sec * 1000, restTotalSec: sec })

export const clearRest = (sessionId: number) =>
  db.sessions.update(sessionId, { restEndsAt: undefined, restTotalSec: undefined })
