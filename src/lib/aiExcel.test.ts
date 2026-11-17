import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSettings } from '../db/db'
import { resetDb } from '../test/resetDb'
import { aiExportSheets } from './aiExcel'
import { colName, crc32, xlsxBytes } from './xlsx'

beforeEach(resetDb)

describe('xlsx writer', () => {
  it('names columns like a spreadsheet', () => {
    expect([0, 25, 26, 51, 52, 701, 702].map(colName)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA'])
  })
  it('computes the zip checksum', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})

describe('AI export as Excel', () => {
  it('has one row per set, run, food entry, activity and weigh-in', async () => {
    await ensureSettings()
    await db.settings.update('app', { goals: { kcal: 2200, kcalMax: 2800, proteinG: 140 } })
    const sid = await db.sessions.add({ date: '2026-11-10', bodyParts: ['chest'], startedAt: 1, finishedAt: 2, dayName: 'Push' })
    await db.sessions.add({ date: '2026-11-11', bodyParts: [], startedAt: 3 }) // open: left out
    const seid = await db.sessionExercises.add({
      sessionId: sid, exerciseId: 1, order: 0, name: 'Smith Machine Bench Press', equipment: 'machine',
      leftRight: false, bodyweight: false, timed: false, targetSets: 2, repMin: 6, repMax: 8, restSec: 150
    })
    await db.sets.bulkAdd([
      { sessionExerciseId: seid, setNumber: 0, type: 'warmup', exerciseId: 1, date: '2026-11-10', weightKg: 20, reps: 10, toFailure: false },
      { sessionExerciseId: seid, setNumber: 1, type: 'working', exerciseId: 1, date: '2026-11-10', weightKg: 35, reps: 7, toFailure: true, goodForm: true },
      { sessionExerciseId: seid, setNumber: 2, type: 'working', exerciseId: 1, date: '2026-11-10', weightKg: 35, reps: 5, toFailure: true }
    ])
    await db.runs.add({ date: '2026-11-12', distanceKm: 5.234, durationSec: 1835, avgHr: 152, maxHr: 171, surface: 'treadmill', type: 'easy' })
    await db.foodEntries.bulkAdd([
      { date: '2026-11-12', time: new Date(2026, 10, 12, 12, 30).getTime(), name: 'ข้าวมันไก่', portion: 1.5, kcal: 900, proteinG: 45 },
      { date: '2026-11-12', time: new Date(2026, 10, 12, 19, 5).getTime(), name: 'Protein shake', portion: 1, kcal: 120, proteinG: 24 }
    ])
    await db.activities.add({ date: '2026-11-13', sport: 'Badminton', minutes: 76, durationSec: 4530, effort: 7 })
    await db.bodyEntries.add({ date: '2026-11-14', weightKg: 72.45 })
    await db.runs.add({ date: '2026-12-01', distanceKm: 3, durationSec: 900 }) // outside the period

    const sheets = await aiExportSheets({ from: '2026-11-01', to: '2026-11-30', categories: new Set(['weights', 'running', 'activities', 'food', 'body']) })
    const byName = Object.fromEntries(sheets.map((s) => [s.name, s]))
    expect(Object.keys(byName)).toEqual(['About', 'Weights', 'Running', 'Other activities', 'Food', 'Food per day', 'Body weight'])

    const w = byName.Weights
    expect(w.rows).toHaveLength(3)
    const col = (h: string) => w.header.indexOf(h)
    expect(w.rows.map((r) => r[col('Set')])).toEqual(['W', '1', '2'])
    expect(w.rows[1][col('Weight (kg)')]).toBe(35)
    expect(w.rows[1][col('Reps')]).toBe(7)
    expect(w.rows[1][col('Good form')]).toBe('Yes')
    expect(w.rows[2][col('Good form')]).toBe('No')
    expect(w.rows[1][col('Target (sets × reps)')]).toBe('2 × 6–8')
    expect(w.header).not.toContain('Rest')

    const r = byName.Running
    expect(r.rows).toHaveLength(1)
    const rc = (h: string) => r.header.indexOf(h)
    expect(r.rows[0][rc('Distance (km)')]).toBe(5.23)
    expect(r.rows[0][rc('Duration')]).toBe('0:30:35')
    expect(r.rows[0][rc('Duration (min)')]).toBe(30.6)
    expect(r.rows[0][rc('Avg HR (bpm)')]).toBe(152)
    expect(r.rows[0][rc('Treadmill or outdoor')]).toBe('Treadmill')

    expect(byName.Food.rows).toEqual([
      ['2026-11-12', '12:30', 'ข้าวมันไก่', 1.5, 900, 45],
      ['2026-11-12', '19:05', 'Protein shake', 1, 120, 24]
    ])
    expect(byName['Food per day'].rows).toEqual([['2026-11-12', 1020, 69, 2, 2200, 2800, 140]])
    expect(byName['Other activities'].rows).toEqual([['2026-11-13', 'Badminton', '1:15:30', 75.5, 7, '']])
    expect(byName['Body weight'].rows).toEqual([['2026-11-14', 72.45]])

    // A zip file (an .xlsx is one) starts with "PK".
    const bytes = xlsxBytes(sheets)
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
  })

  it('leaves out categories that were not ticked', async () => {
    await ensureSettings()
    const sheets = await aiExportSheets({ from: '2026-11-01', to: '2026-11-30', categories: new Set(['food']) })
    expect(sheets.map((s) => s.name)).toEqual(['About', 'Food', 'Food per day'])
  })
})
