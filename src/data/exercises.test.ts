import { beforeEach, describe, expect, it } from 'vitest'
import seeds from './exercises.json'
import { db } from '../db/db'
import { seedExercises } from '../db/seed'
import { searchExercises } from '../lib/exerciseSearch'
import type { Exercise } from '../db/types'
import { resetDb } from '../test/resetDb'

type Seed = (typeof seeds)[number]
const data = seeds as Seed[]
const MUSCLES = new Set([
  'chest_upper', 'chest_lower', 'delt_front', 'delt_side', 'delt_rear', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'traps', 'lats', 'mid_back', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'calves'
])
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

describe('the exercise library data (C)', () => {
  it('has roughly 850 to 900 exercises', () => {
    expect(data.length).toBeGreaterThanOrEqual(850)
    expect(data.length).toBeLessThanOrEqual(900)
  })

  it('logs stretches and cardio as time, and stretches need no weight', () => {
    const stretch = data.find((e) => e.name === 'Triceps Stretch')!
    expect(stretch.timed).toBe(true)
    expect(stretch.bodyweight).toBe(true)
    expect(data.find((e) => e.name === 'Elliptical Trainer')!.timed).toBe(true)
    expect(data.some((e) => /\bSMR\b/.test(e.name))).toBe(false)
  })

  it('keeps the first 249 hand-picked exercises exactly as released', () => {
    // FNV-1a fingerprint of the released entries (no Node types are installed for crypto).
    const json = JSON.stringify(data.slice(0, 249))
    let h = 0x811c9dc5
    for (let i = 0; i < json.length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
    expect(json.length).toBe(55332)
    expect(h.toString(16)).toBe('1ba5b574')
    expect(data[248].key).not.toMatch(/^extra-/)
  })

  it('has a unique seed key and a unique name for every exercise', () => {
    expect(new Set(data.map((e) => e.key)).size).toBe(data.length)
    expect(new Set(data.map((e) => norm(e.name))).size).toBe(data.length)
  })

  it('gives every exercise a valid equipment, body part and at least one primary muscle', () => {
    const equipment = new Set(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'])
    for (const e of data) {
      expect(equipment.has(e.equipment), e.name).toBe(true)
      expect(e.primaryMuscles.length, e.name).toBeGreaterThan(0)
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(MUSCLES.has(m), `${e.name}: ${m}`).toBe(true)
      expect(e.primaryMuscles.filter((m) => e.secondaryMuscles.includes(m)), e.name).toEqual([])
    }
  })

  it('leaves out olympic lifts, assisted variants and foam rolling', () => {
    for (const e of data.slice(249)) {
      expect(e.name, e.name).not.toMatch(/\bpower clean\b|\bsnatch\b|\bjerk\b|assist/i)
    }
    expect(data.some((e) => /^power clean$/i.test(e.name))).toBe(false)
  })

  it('has extras only under the extra- prefix, after the picked ones', () => {
    const extras = data.filter((e) => e.key.startsWith('extra-'))
    expect(extras.length).toBeGreaterThanOrEqual(9)
    for (const e of extras) expect(data.indexOf(e)).toBeGreaterThanOrEqual(249)
    const names = data.map((e) => e.name)
    for (const n of [
      'Machine Lateral Raise', 'Machine Incline Chest Press', 'Machine Seated Row', 'Machine Pullover',
      'Machine Torso Rotation', 'Machine Back Extension', 'Machine Glute Kickback', 'Hip Thrust Machine'
    ]) expect(names).toContain(n)
  })

  it('covers every muscle region with at least 10 exercises', () => {
    for (const m of MUSCLES) {
      expect(data.filter((e) => e.primaryMuscles.includes(m as never)).length, m).toBeGreaterThanOrEqual(10)
    }
  })

  it('flags holds as timed and one-sided moves as left/right', () => {
    const by = (n: string) => data.find((e) => e.name === n)!
    expect(by('Plank').timed).toBe(true)
    expect(by('Copenhagen Plank')).toMatchObject({ timed: true, leftRight: true })
    expect(by('Isometric Neck Exercise - Sides').timed).toBe(true)
    expect(by('Push Up to Side Plank').timed).toBe(false)
    expect(by('Single-Arm Push-Up').leftRight).toBe(true)
    expect(by('Standing Concentration Curl').leftRight).toBe(true)
    expect(by('Seated Close-Grip Concentration Barbell Curl').leftRight).toBe(false)
  })
})

describe('searching the full library', () => {
  const library: Exercise[] = data.map((s, i) => ({ ...(s as unknown as Exercise), id: i + 1, isCustom: false }))
  it('finds "lateral raise machine" -> Machine Lateral Raise', () => {
    const names = searchExercises(library, 'lateral raise machine').map((e) => e.name)
    expect(names).toContain('Machine Lateral Raise')
    expect(names[0]).toBe('Machine Lateral Raise')
  })
})

describe('seeding a library that grew', () => {
  beforeEach(resetDb)

  it('adds every exercise on a fresh install, once', async () => {
    await seedExercises()
    await seedExercises()
    expect(await db.exercises.count()).toBe(data.length)
  })

  it('adds only the missing exercises to an install that has the first 249, and never touches them', async () => {
    const old = data.slice(0, 249).map((s) => ({ ...(s as unknown as Exercise), seedKey: s.key, isCustom: false }))
    const ids = await db.exercises.bulkAdd(old, { allKeys: true })
    // The owner edited one of them.
    await db.exercises.update(ids[3], { primaryMuscles: ['calves'], leftRight: true })
    const before = await db.exercises.toArray()
    await seedExercises()
    expect(await db.exercises.count()).toBe(data.length)
    const after = await db.exercises.bulkGet(before.map((e) => e.id!))
    expect(after).toEqual(before)
    expect((await db.exercises.get(ids[3]))?.primaryMuscles).toEqual(['calves'])
  })
})
