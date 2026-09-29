import { describe, expect, it, beforeEach } from 'vitest'
import { clearHistory, eraseEverything, getDeleteCounts, aiPeriodPreset } from './backup'
import { db, ensureSettings } from '../db/db'
import { resetDb } from '../test/resetDb'
import { seedExercises } from '../db/seed'

beforeEach(resetDb)

describe('aiPeriodPreset', () => {
  it('last2weeks returns a 14-day range', () => {
    const { from, to } = aiPeriodPreset('2weeks')
    const d = new Date(to + 'T00:00')
    const f = new Date(from + 'T00:00')
    const diff = Math.round((d.getTime() - f.getTime()) / 86400000)
    expect(diff).toBe(13)
    expect(to).toBe(to) // today
  })

  it('month returns a range starting on the 1st of the month', () => {
    const { from } = aiPeriodPreset('month')
    expect(from.slice(-2)).toBe('01')
  })
})

describe('clearHistory', () => {
  it('deletes sessions but keeps exercises', async () => {
    await seedExercises()
    await db.sessions.add({ date: '2026-01-01', bodyParts: [], startedAt: 0 })
    await clearHistory(new Set(['weights']))
    expect(await db.sessions.count()).toBe(0)
    expect(await db.exercises.count()).toBeGreaterThan(0)
  })

  it('deletes only selected categories', async () => {
    await db.runs.add({ date: '2026-01-01', type: 'easy', distanceKm: 5, durationSec: 1800 })
    await db.activities.add({ date: '2026-01-01', sport: 'Badminton', minutes: 60 })
    await clearHistory(new Set(['runs']))
    expect(await db.runs.count()).toBe(0)
    expect(await db.activities.count()).toBe(1)
  })
})

describe('eraseEverything', () => {
  it('re-seeds exercises and creates settings', async () => {
    await seedExercises()
    await ensureSettings()
    await db.runs.add({ date: '2026-01-01', type: 'easy', distanceKm: 5, durationSec: 1800 })
    await eraseEverything()
    expect(await db.runs.count()).toBe(0)
    expect(await db.exercises.count()).toBeGreaterThan(0)
    expect(await db.settings.get('app')).toBeTruthy()
  })
})
