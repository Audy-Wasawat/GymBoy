import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createExercise, findExerciseByName } from './exercises'
import { recomputeAllBodyParts, refreshBodyParts } from './sessions'
import { dayBodyParts } from './programs'
import { resetDb } from '../test/resetDb'

beforeEach(resetDb)

const base = { equipment: 'machine' as const, secondaryMuscles: [], leftRight: false, timed: false }

describe('creating exercises (B3)', () => {
  it('creates a custom exercise and returns it with its id', async () => {
    const ex = await createExercise({ ...base, name: '  My Press ', primaryMuscles: ['chest_upper'] })
    expect(ex.id).toBeGreaterThan(0)
    expect(ex.name).toBe('My Press')
    expect((await db.exercises.get(ex.id!))?.isCustom).toBe(true)
  })

  it('sets the bodyweight flag from the equipment', async () => {
    const ex = await createExercise({ ...base, equipment: 'bodyweight', name: 'Hollow Hold', primaryMuscles: ['abs'] })
    expect(ex.bodyweight).toBe(true)
  })

  it('finds an existing name ignoring case and spaces', async () => {
    await createExercise({ ...base, name: 'Machine Lateral Raise', primaryMuscles: ['delt_side'] })
    expect((await findExerciseByName('  machine lateral RAISE '))?.name).toBe('Machine Lateral Raise')
    expect(await findExerciseByName('Something else')).toBeUndefined()
    expect(await findExerciseByName('   ')).toBeUndefined()
  })
})

describe('body parts of custom exercises (B4)', () => {
  async function sessionWith(exerciseId: number, type: 'working' | 'warmup' = 'working') {
    const sid = await db.sessions.add({ date: '2026-09-29', bodyParts: [], startedAt: 1, finishedAt: 2 })
    const seId = await db.sessionExercises.add({
      sessionId: sid, exerciseId, order: 0, name: 'X', equipment: 'machine', leftRight: false, bodyweight: false, timed: false
    })
    await db.sets.add({ sessionExerciseId: seId, setNumber: 0, type, exerciseId, date: '2026-09-29', weightKg: 10, reps: 5, toFailure: false })
    return sid
  }

  it('a custom exercise without a body part labels the session from its muscle', async () => {
    const ex = await createExercise({ ...base, name: 'Custom Row', primaryMuscles: ['mid_back'] })
    const sid = await sessionWith(ex.id!)
    await refreshBodyParts(sid)
    expect((await db.sessions.get(sid))?.bodyParts).toEqual(['back'])
  })

  it('an exercise with neither part nor muscles adds no label', async () => {
    const ex = await createExercise({ ...base, name: 'Mystery', primaryMuscles: [] })
    const sid = await sessionWith(ex.id!)
    await refreshBodyParts(sid)
    expect((await db.sessions.get(sid))?.bodyParts).toEqual([])
  })

  it('a program day gets its parts from the exercises\' muscles too', async () => {
    const ex = await createExercise({ ...base, name: 'Custom Curl', primaryMuscles: ['biceps'] })
    const pid = await db.programs.add({ name: 'P', isActive: true, createdAt: 1 })
    const did = await db.programDays.add({ programId: pid, name: 'D', bodyParts: [], order: 0 })
    await db.programExercises.add({ dayId: did, exerciseId: ex.id!, order: 0, targetSets: 2, repMin: 6, repMax: 8, restSec: 90 })
    expect(await dayBodyParts(did)).toEqual(['biceps'])
  })

  it('recomputing follows a later change of the exercise and skips warm-up-only exercises', async () => {
    const ex = await createExercise({ ...base, name: 'Custom Move', primaryMuscles: ['quads'] })
    const sid = await sessionWith(ex.id!)
    const warm = await createExercise({ ...base, name: 'Warm Only', primaryMuscles: ['calves'] })
    const sid2 = await sessionWith(warm.id!, 'warmup')
    await recomputeAllBodyParts()
    expect((await db.sessions.get(sid))?.bodyParts).toEqual(['quads'])
    expect((await db.sessions.get(sid2))?.bodyParts).toEqual([])
    await db.exercises.update(ex.id!, { primaryMuscles: ['hamstrings'] })
    await recomputeAllBodyParts()
    expect((await db.sessions.get(sid))?.bodyParts).toEqual(['hamstrings'])
  })
})
