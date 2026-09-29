import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { emptyDraft } from './sessions'
import { withSavedSets, workoutSessions } from './workoutDays'
import { resetDb } from '../test/resetDb'

beforeEach(resetDb)

async function session(date: string, opts: { sets?: ('working' | 'warmup')[]; drafts?: number; finished?: boolean } = {}) {
  const id = await db.sessions.add({ date, bodyParts: [], startedAt: 1, finishedAt: opts.finished === false ? undefined : 2 })
  const seId = await db.sessionExercises.add({
    sessionId: id, exerciseId: 1, order: 0, name: 'Bench', equipment: 'barbell', leftRight: false, bodyweight: false, timed: false
  })
  for (const [i, type] of (opts.sets ?? []).entries()) {
    await db.sets.add({ sessionExerciseId: seId, setNumber: i, type, exerciseId: 1, date, weightKg: 50, reps: 5, toFailure: false })
  }
  for (let i = 0; i < (opts.drafts ?? 0); i++) await db.setDrafts.add(emptyDraft(seId, i))
  return id
}

describe('workout days (A2)', () => {
  it('a session with no saved set is not a workout', async () => {
    await session('2026-09-29', { finished: false })
    expect(await workoutSessions()).toHaveLength(0)
  })

  it('unsaved drafts do not make a workout', async () => {
    await session('2026-09-29', { drafts: 3, finished: false })
    expect(await workoutSessions('2026-09-29', '2026-09-29')).toHaveLength(0)
  })

  it('any saved set counts, including a warm-up only', async () => {
    await session('2026-09-28', { sets: ['warmup'] })
    await session('2026-09-29', { sets: ['working'], finished: false })
    const list = await workoutSessions()
    expect(list.map((s) => s.date).sort()).toEqual(['2026-09-28', '2026-09-29'])
  })

  it('respects the date range and open lower bound', async () => {
    await session('2026-09-01', { sets: ['working'] })
    await session('2026-09-15', { sets: ['working'] })
    await session('2026-10-01', { sets: ['working'] })
    expect((await workoutSessions('2026-09-01', '2026-09-30')).map((s) => s.date)).toEqual(['2026-09-01', '2026-09-15'])
    expect((await workoutSessions('2026-09-10')).map((s) => s.date).sort()).toEqual(['2026-09-15', '2026-10-01'])
  })

  it('a day with one empty and one real session counts once, from the real one', async () => {
    await session('2026-09-29', { finished: false })
    await session('2026-09-29', { sets: ['working'] })
    const list = await workoutSessions('2026-09-29', '2026-09-29')
    expect(list).toHaveLength(1)
    expect(await withSavedSets([])).toEqual([])
  })
})
