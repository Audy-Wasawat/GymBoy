import { beforeEach, describe, expect, it } from 'vitest'
import seeds from '../data/exercises.json'
import { db } from './db'
import { createExercise } from './exercises'
import { addFoodEntry } from './food'
import { addExerciseToSession, emptyDraft, saveDraft, startSession } from './sessions'
import { createBackup, parseBackup, restoreBackup } from '../lib/backup'
import { fieldsFromEntry, finalValues, sameFields } from '../lib/foodEntry'
import { fromDisplayWeight, toDisplayWeight } from '../lib/units'
import type { Exercise } from './types'
import { resetDb } from '../test/resetDb'

beforeEach(resetDb)

describe('editing a food entry does not multiply by the portion again', () => {
  it('shows per-portion values for an entry that stores final values', () => {
    const f = fieldsFromEntry({ kcal: 400, proteinG: 8, portion: 2 })
    expect(f).toEqual({ kcal: '200', protein: '4', portion: '2' })
    const v = finalValues(f)
    expect([v.kcal, v.proteinG, v.portion]).toEqual([400, 8, 2])
  })

  it('a portion that does not divide evenly still comes back to the same numbers', () => {
    const stored = { kcal: 400, proteinG: 10, portion: 3 }
    const v = finalValues(fieldsFromEntry(stored))
    expect([v.kcal, v.proteinG]).toEqual([400, 10])
  })

  it('a decimal portion and comma decimals work', () => {
    expect(fieldsFromEntry({ kcal: 300, proteinG: 15, portion: 1.5 })).toEqual({ kcal: '200', protein: '10', portion: '1.5' })
    const v = finalValues({ kcal: '250,5', protein: '12,5', portion: '1,5' })
    expect([v.baseKcal, v.baseProtein, v.portion, v.kcal, v.proteinG]).toEqual([250.5, 12.5, 1.5, 376, 18.8])
  })

  it('detects unchanged fields so the stored numbers can be kept as they are', () => {
    const a = fieldsFromEntry({ kcal: 401, proteinG: 8.1, portion: 3 })
    expect(sameFields(a, { ...a })).toBe(true)
    expect(sameFields(a, { ...a, portion: '4' })).toBe(false)
  })
})

describe('body weight in lb does not drift when only a photo changes', () => {
  it('shows why the stored kg must be kept when the shown weight is unchanged', () => {
    const shown = String(toDisplayWeight(72.5, 'lb'))
    // Converting the rounded lb value back would change the stored weight.
    expect(fromDisplayWeight(Number(shown), 'lb')).not.toBe(72.5)
    expect(Math.abs(fromDisplayWeight(Number(shown), 'lb') - 72.5)).toBeLessThan(0.05)
  })
})

describe('saving a draft twice', () => {
  it('adds one set only', async () => {
    const ex = await createExercise({
      name: 'Curl', equipment: 'dumbbell', primaryMuscles: ['biceps'], secondaryMuscles: [], leftRight: false, timed: false
    })
    const sid = await startSession()
    await addExerciseToSession(sid, ex)
    const se = (await db.sessionExercises.where('sessionId').equals(sid).first())!
    const draft = { ...(await db.setDrafts.where('sessionExerciseId').equals(se.id!).first())!, weight: '10', value: '8' }
    const [a, b] = await Promise.all([saveDraft(draft, se, 'kg', '2026-09-29'), saveDraft(draft, se, 'kg', '2026-09-29')])
    expect([a, b].filter(Boolean)).toHaveLength(1)
    expect(await db.sets.count()).toBe(1)
    expect(emptyDraft(1, 0).type).toBe('working')
  })
})

describe('restoring a backup (values, photos, library)', () => {
  const restore = async (edit: (json: Record<string, unknown[]>) => void) => {
    const json = JSON.parse(await (await createBackup()).text())
    edit(json)
    const { data } = await parseBackup(new File([JSON.stringify(json)], 'b.json'))
    await restoreBackup(data)
  }
  const parse = async (edit: (json: Record<string, any[]>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const json = JSON.parse(await (await createBackup()).text())
    edit(json)
    return parseBackup(new File([JSON.stringify(json)], 'b.json'))
  }

  it('refuses values of the wrong type and leaves the data alone', async () => {
    await db.runs.add({ date: '2026-09-01', type: 'easy', distanceKm: 5, durationSec: 1500 })
    const before = await db.runs.toArray()
    await expect(parse((j) => { j.runs[0].date = 5 })).rejects.toThrow()
    await expect(parse((j) => { j.runs[0].date = '29/09/2026' })).rejects.toThrow()
    await expect(parse((j) => { j.runs[0].distanceKm = 'abc' })).rejects.toThrow()
    await expect(parse((j) => { j.settings[0].language = 'xx' })).rejects.toThrow()
    await expect(parse((j) => { j.settings[0].weightUnit = 'stone' })).rejects.toThrow()
    await expect(parse((j) => { j.runs = ['abc'] })).rejects.toThrow()
    expect(await db.runs.toArray()).toEqual(before)
  })

  it('accepts what the app itself writes, including optional and missing fields', async () => {
    await db.settings.put({ id: 'app', language: 'en', weightUnit: 'lb', defaultRestSec: 90, goals: {} })
    await db.sets.add({ sessionExerciseId: 1, setNumber: 0, type: 'working', exerciseId: 1, date: '2026-09-29', durationSec: 40, toFailure: false })
    await db.shoes.add({ name: 'Pair', retired: false, startKm: 12.5 })
    await expect(parse(() => {})).resolves.toBeTruthy()
  })

  it('drops one damaged photo instead of failing the whole restore', async () => {
    const id = await addFoodEntry({
      date: '2026-09-29', time: 1, name: 'Rice', portion: 1, kcal: 200, proteinG: 4,
      photo: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    })
    await restore((j) => { (j.foodEntries[0] as { photo: string }).photo = 'data:image/jpeg;base64,@@@@not base64!!' })
    const e = (await db.foodEntries.get(id))!
    expect(e.photo).toBeUndefined()
    expect(e.name).toBe('Rice')
  })

  it('brings the library up to date when the backup holds an older, smaller one', async () => {
    const first249: Exercise[] = (seeds as Array<Record<string, unknown>>).slice(0, 249).map((s) => ({
      ...(s as unknown as Exercise), seedKey: s.key as string, isCustom: false
    }))
    await db.exercises.bulkAdd(first249)
    await restore(() => {})
    expect(await db.exercises.count()).toBe(seeds.length)
  })

  it('works out session body parts again after a restore', async () => {
    const ex = await createExercise({
      name: 'Custom Row', equipment: 'machine', primaryMuscles: ['mid_back'], secondaryMuscles: [], leftRight: false, timed: false
    })
    const sid = await db.sessions.add({ date: '2026-09-29', bodyParts: [], startedAt: 1, finishedAt: 2 })
    const seId = await db.sessionExercises.add({
      sessionId: sid, exerciseId: ex.id!, order: 0, name: 'Custom Row', equipment: 'machine', leftRight: false, bodyweight: false, timed: false
    })
    await db.sets.add({ sessionExerciseId: seId, setNumber: 0, type: 'working', exerciseId: ex.id!, date: '2026-09-29', weightKg: 10, reps: 5, toFailure: false })
    await restore(() => {})
    expect((await db.sessions.get(sid))?.bodyParts).toEqual(['back'])
  })
})
