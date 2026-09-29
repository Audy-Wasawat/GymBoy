import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createExercise } from './exercises'
import { addExerciseToSession, emptyDraft, previousEntry, saveDraft, setSessionLeftRight, setToText, startSession } from './sessions'
import { loadProgress, weightHint } from '../lib/progress'
import { setSummary } from '../lib/setFormat'
import type { SessionExercise, SetLog } from './types'
import { resetDb } from '../test/resetDb'

beforeEach(resetDb)

const set = (o: Partial<SetLog>): SetLog => ({
  sessionExerciseId: 1, setNumber: 0, type: 'working', exerciseId: 1, date: '2026-09-29', toFailure: false, ...o
})
const se = (o: Partial<SessionExercise> = {}): SessionExercise => ({
  sessionId: 1, exerciseId: 1, order: 0, name: 'Curl', equipment: 'dumbbell',
  leftRight: false, bodyweight: false, timed: false, ...o
})

describe('previous values across both-sides and left/right modes (D2)', () => {
  it('shows a single logged value as it is, even if the exercise is now left/right', () => {
    expect(setSummary(set({ weightKg: 12, reps: 10 }), se({ leftRight: true }), 'kg')).toBe('12×10')
  })
  it('shows left/right values even if the exercise is now both-sides', () => {
    expect(setSummary(set({ weightKg: 12, repsLeft: 10, repsRight: 9 }), se({ leftRight: false }), 'kg')).toBe('12×10/9')
  })
  it('never shows a blank pair', () => {
    for (const s of [set({ weightKg: 10, reps: 8 }), set({ weightKg: 10, repsLeft: 8, repsRight: 8 })]) {
      for (const leftRight of [false, true]) expect(setSummary(s, se({ leftRight }), 'kg')).not.toMatch(/–/)
    }
  })
  it('shows timed sets in seconds whichever mode', () => {
    expect(setSummary(set({ durationLeftSec: 40, durationRightSec: 35 }), se({ timed: true }), 'kg')).toBe('40/35')
    expect(setSummary(set({ weightKg: 5, durationSec: 65 }), se({ timed: true, bodyweight: true }), 'kg')).toBe('+5×1:05')
  })

  it('copies a single value into both sides, and two sides into their lower value', () => {
    const single = set({ weightKg: 12, reps: 10 })
    expect(setToText(single, se({ leftRight: true }), 'kg')).toEqual({ weight: '12', value: '', left: '10', right: '10' })
    const sides = set({ weightKg: 12, repsLeft: 10, repsRight: 8 })
    expect(setToText(sides, se({ leftRight: false }), 'kg')).toEqual({ weight: '12', value: '8', left: '', right: '' })
    expect(setToText(sides, se({ leftRight: true }), 'kg')).toEqual({ weight: '12', value: '', left: '10', right: '8' })
  })

  it('the weight hint follows the previous session, whatever mode is used now', () => {
    const target = { targetSets: 2, repMin: 6, repMax: 8, restSec: 90 }
    const prevSingle = { se: se({ ...target, leftRight: false }), sets: [set({ weightKg: 20, reps: 8 }), set({ weightKg: 20, reps: 8 })] }
    expect(weightHint(prevSingle, [])).toMatchObject({ top: 8, weightKg: 20 })
    const prevSides = {
      se: se({ ...target, leftRight: true }),
      sets: [set({ weightKg: 20, repsLeft: 8, repsRight: 8 }), set({ weightKg: 20, repsLeft: 9, repsRight: 8 })]
    }
    expect(weightHint(prevSides, [])).toMatchObject({ top: 8, weightKg: 20 })
    // One side short on a set: no hint.
    const short = { ...prevSides, sets: [set({ weightKg: 20, repsLeft: 8, repsRight: 7 }), set({ weightKg: 20, repsLeft: 8, repsRight: 8 })] }
    expect(weightHint(short, [])).toBeUndefined()
  })

  it('a PR is found across sessions logged in different modes (reps, lower side)', async () => {
    const pullUp = await createExercise({
      name: 'Pull-Up', equipment: 'bodyweight', primaryMuscles: ['lats'], secondaryMuscles: [], leftRight: false, timed: false
    })
    const mk = async (date: string, s: Partial<SetLog>, leftRight: boolean) => {
      const sid = await db.sessions.add({ date, bodyParts: [], startedAt: 1, finishedAt: 2 })
      const seId = await db.sessionExercises.add({
        sessionId: sid, exerciseId: pullUp.id!, order: 0, name: 'Pull-Up', equipment: 'bodyweight', leftRight, bodyweight: true, timed: false
      })
      return db.sets.add({ ...set({ sessionExerciseId: seId, exerciseId: pullUp.id!, date }), ...s })
    }
    await mk('2026-09-01', { reps: 8 }, false)
    const both = await mk('2026-09-08', { reps: 10 }, false)
    const lr = await mk('2026-09-15', { repsLeft: 12, repsRight: 11 }, true) // lower side 11 beats 10
    const worse = await mk('2026-09-22', { repsLeft: 12, repsRight: 9 }, true) // lower side 9 does not
    const p = (await loadProgress(pullUp.id!))!
    expect(p.kind).toBe('reps')
    expect([...p.prIds].sort()).toEqual([both, lr].sort())
    expect(p.prIds.has(worse)).toBe(false)
    expect(p.best?.value).toBe(11)
    expect(p.points.map((x) => x.value)).toEqual([8, 10, 11, 9])
  })
})

describe('switching an exercise to left/right during a session (D1)', () => {
  async function open() {
    const curl = await createExercise({
      name: 'Dumbbell Curl', equipment: 'dumbbell', primaryMuscles: ['biceps'], secondaryMuscles: [], leftRight: false, timed: false
    })
    const sid = await startSession()
    await addExerciseToSession(sid, curl)
    const seRow = (await db.sessionExercises.where('sessionId').equals(sid).first())!
    return { curl, sid, se: seRow }
  }

  it('changes this session and the exercise default', async () => {
    const { curl, se: row } = await open()
    expect(await setSessionLeftRight(row.id!, true)).toBe(true)
    expect((await db.sessionExercises.get(row.id!))?.leftRight).toBe(true)
    expect((await db.exercises.get(curl.id!))?.leftRight).toBe(true)
    // The next session starts in the remembered mode.
    await db.sessions.update(row.sessionId, { finishedAt: Date.now() })
    const sid2 = await startSession()
    await addExerciseToSession(sid2, (await db.exercises.get(curl.id!))!)
    expect((await db.sessionExercises.where('sessionId').equals(sid2).first())?.leftRight).toBe(true)
  })

  it('is refused once the exercise has a saved set', async () => {
    const { curl, se: row } = await open()
    const draft = { ...(await db.setDrafts.where('sessionExerciseId').equals(row.id!).first())!, weight: '10', value: '8' }
    expect(await saveDraft(draft, row, 'kg', '2026-09-29')).toBe(true)
    expect(await setSessionLeftRight(row.id!, true)).toBe(false)
    expect((await db.sessionExercises.get(row.id!))?.leftRight).toBe(false)
    expect((await db.exercises.get(curl.id!))?.leftRight).toBe(false)
  })

  it('converts typed rows so nothing typed is lost, both ways', async () => {
    const { se: row } = await open()
    const id = (await db.setDrafts.add({ ...emptyDraft(row.id!, 5), weight: '10', value: '8' }))
    await setSessionLeftRight(row.id!, true)
    expect(await db.setDrafts.get(id)).toMatchObject({ weight: '10', value: '', left: '8', right: '8' })
    await db.setDrafts.update(id, { left: '10', right: '7' })
    await setSessionLeftRight(row.id!, false)
    expect(await db.setDrafts.get(id)).toMatchObject({ value: '7', left: '', right: '' })
  })

  it('still finds the previous sets after a mode change between sessions', async () => {
    const { curl, se: row, sid } = await open()
    const draft = { ...(await db.setDrafts.where('sessionExerciseId').equals(row.id!).first())!, weight: '10', value: '8' }
    await saveDraft(draft, row, 'kg', '2026-09-29')
    await db.sessions.update(sid, { finishedAt: Date.now() })
    const sid2 = await startSession()
    await addExerciseToSession(sid2, { ...curl, leftRight: true })
    const prev = await previousEntry(curl.id!, sid2)
    expect(prev?.sets).toHaveLength(1)
    expect(setSummary(prev!.sets[0], { bodyweight: false, timed: false }, 'kg')).toBe('10×8')
  })
})
