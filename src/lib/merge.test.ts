import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSettings } from '../db/db'
import { seedExercises } from '../db/seed'
import { storePhoto } from '../db/photoStore'
import { resetDb } from '../test/resetDb'
import { createBackup, parseBackup } from './backup'
import { mergeBackup } from './merge'

beforeEach(resetDb)

const photo = (seed: number) => new Blob([Uint8Array.from({ length: 200 }, (_, i) => (i * 3 + seed) % 256)], { type: 'image/jpeg' })

/** Builds "the old phone": logs some history, makes a backup file, then wipes the phone. */
async function oldPhoneBackup() {
  await ensureSettings()
  await seedExercises()
  await db.settings.update('app', { goals: { kcal: 1800 } })
  const bench = (await db.exercises.toArray())[0]
  const custom = await db.exercises.add({ name: 'My cable fly', equipment: 'cable', primaryMuscles: ['chest_lower'], secondaryMuscles: [], leftRight: false, bodyweight: false, timed: false, isCustom: true })
  const shoe = await db.shoes.add({ name: 'Pegasus', retired: false })
  const egg = await db.foods.add({ name: 'Boiled egg', kcal: 70, proteinG: 6, photoKey: await storePhoto(photo(1)) })
  const sid = await db.sessions.add({ date: '2026-11-01', bodyParts: ['chest'], startedAt: 1000, finishedAt: 2000, dayName: 'Push' })
  for (const [i, exId] of [bench.id!, custom].entries()) {
    const se = await db.sessionExercises.add({ sessionId: sid, exerciseId: exId, order: i, name: i ? 'My cable fly' : bench.name, equipment: 'barbell', leftRight: false, bodyweight: false, timed: false })
    await db.sets.add({ sessionExerciseId: se, setNumber: 1, type: 'working', exerciseId: exId, date: '2026-11-01', weightKg: 35, reps: 7, toFailure: true, goodForm: true })
  }
  await db.runs.add({ date: '2026-11-02', distanceKm: 5, durationSec: 1800, shoeId: shoe })
  await db.foodEntries.add({ date: '2026-11-02', time: 111, foodId: egg, name: 'Boiled egg', portion: 2, kcal: 140, proteinG: 12, photoKey: (await db.foods.get(egg))!.photoKey })
  await db.activities.add({ date: '2026-11-03', sport: 'Badminton', minutes: 60, durationSec: 3600, effort: 6 })
  await db.bodyEntries.add({ date: '2026-11-03', weightKg: 72 })
  const { data } = await parseBackup(new File([await createBackup({ photos: true })], 'old.json'))
  await resetDb()
  return data
}

/** "The new phone": two days of its own logging, with ids that clash with the old phone's. */
async function newPhoneDays() {
  await ensureSettings()
  await seedExercises()
  await db.settings.update('app', { goals: { kcal: 2200, kcalMax: 2800 } })
  const bench = (await db.exercises.toArray())[0]
  const sid = await db.sessions.add({ date: '2026-11-16', bodyParts: ['chest'], startedAt: 9000, finishedAt: 9500, dayName: 'Push' })
  const se = await db.sessionExercises.add({ sessionId: sid, exerciseId: bench.id!, order: 0, name: bench.name, equipment: 'barbell', leftRight: false, bodyweight: false, timed: false })
  await db.sets.add({ sessionExerciseId: se, setNumber: 1, type: 'working', exerciseId: bench.id!, date: '2026-11-16', weightKg: 35, reps: 8, toFailure: false, goodForm: true })
  await db.runs.add({ date: '2026-11-17', distanceKm: 3, durationSec: 1100 })
  await db.foodEntries.add({ date: '2026-11-17', time: 999, name: 'Toast', portion: 1, kcal: 90, proteinG: 3 })
}

describe('importing by merging', () => {
  it('keeps the days logged on the new phone and adds the old history', async () => {
    const data = await oldPhoneBackup()
    await newPhoneDays()
    const result = await mergeBackup(data)

    expect(result.added).toEqual({ sessions: 1, runs: 1, foodEntries: 1, activities: 1, bodyEntries: 1 })
    expect((await db.sessions.toArray()).map((s) => s.date).sort()).toEqual(['2026-11-01', '2026-11-16'])
    expect((await db.runs.toArray()).map((r) => r.date).sort()).toEqual(['2026-11-02', '2026-11-17'])
    expect((await db.foodEntries.toArray()).map((e) => e.name).sort()).toEqual(['Boiled egg', 'Toast'])
    // The phone's own settings win.
    expect((await db.settings.get('app'))?.goals).toEqual({ kcal: 2200, kcalMax: 2800 })
  })

  it('rewires every link: sets to their exercises, runs to shoes, entries to library foods and photos', async () => {
    const data = await oldPhoneBackup()
    await newPhoneDays()
    await mergeBackup(data)

    const old = (await db.sessions.where('date').equals('2026-11-01').first())!
    const ses = await db.sessionExercises.where('sessionId').equals(old.id!).sortBy('order')
    expect(ses.map((x) => x.name)).toEqual([expect.any(String), 'My cable fly'])
    for (const se of ses) {
      const ex = (await db.exercises.get(se.exerciseId))!
      expect(ex.name).toBe(se.name)
      const sets = await db.sets.where('sessionExerciseId').equals(se.id!).toArray()
      expect(sets).toHaveLength(1)
      expect(sets[0]).toMatchObject({ exerciseId: se.exerciseId, weightKg: 35, reps: 7, goodForm: true })
    }
    // The custom exercise was added once, not duplicated.
    expect(await db.exercises.filter((e) => e.name === 'My cable fly').count()).toBe(1)

    const run = (await db.runs.where('date').equals('2026-11-02').first())!
    expect((await db.shoes.get(run.shoeId!))?.name).toBe('Pegasus')

    const egg = (await db.foodEntries.filter((e) => e.name === 'Boiled egg').first())!
    expect((await db.foods.get(egg.foodId!))?.name).toBe('Boiled egg')
    expect(egg.photoKey).toBeDefined()
    expect((await db.photos.get(egg.photoKey!))?.blob.size).toBe(200)
  })

  it('importing the same file twice adds nothing the second time', async () => {
    const data = await oldPhoneBackup()
    await newPhoneDays()
    await mergeBackup(data)
    const counts = async () => Promise.all([db.sessions.count(), db.sets.count(), db.runs.count(), db.foodEntries.count(), db.activities.count(), db.bodyEntries.count(), db.foods.count(), db.shoes.count(), db.photos.count()])
    const before = await counts()
    const second = await mergeBackup(data)
    expect(second.added).toEqual({ sessions: 0, runs: 0, foodEntries: 0, activities: 0, bodyEntries: 0 })
    expect(second.skipped).toBe(5)
    expect(await counts()).toEqual(before)
  })

  it('merging into the same phone the file came from changes nothing', async () => {
    const data = await oldPhoneBackup()
    // Put the old phone back as it was, then merge its own file into it.
    const { restoreBackup } = await import('./backup')
    await restoreBackup(data)
    const result = await mergeBackup(data)
    expect(result.added).toEqual({ sessions: 0, runs: 0, foodEntries: 0, activities: 0, bodyEntries: 0 })
  })

  it('never leaves two sessions open', async () => {
    await ensureSettings()
    await db.sessions.add({ date: '2026-11-01', bodyParts: [], startedAt: 5 })
    const { data } = await parseBackup(new File([await createBackup({ photos: false })], 'b.json'))
    await resetDb()
    await ensureSettings()
    await db.sessions.add({ date: '2026-11-17', bodyParts: [], startedAt: 77 })
    await mergeBackup(data)
    expect(await db.sessions.filter((s) => !s.finishedAt).count()).toBe(1)
  })
})
