import { beforeEach, describe, expect, it } from 'vitest'
import { createBackup, parseBackup, restoreBackup } from './backup'
import { db, ensureSettings } from '../db/db'
import { activitySec } from '../db/activities'
import { resetDb } from '../test/resetDb'
import { gridPartsLabel } from './gridLabel'
import { strings, type StringKey } from '../i18n/strings'

beforeEach(resetDb)

async function roundTrip(edit: (json: Record<string, unknown>) => void) {
  const blob = await createBackup()
  const json = JSON.parse(await blob.text())
  edit(json)
  const file = new File([JSON.stringify(json)], 'b.json', { type: 'application/json' })
  const { data } = await parseBackup(file)
  await restoreBackup(data)
}

describe('activity effort 1-10 and h:m:s duration', () => {
  it('a backup from before schema v4 has its 1-5 effort doubled', async () => {
    await ensureSettings()
    await db.activities.add({ date: '2026-10-01', sport: 'Badminton', minutes: 60, effort: 3 })
    await roundTrip((j) => { j.schemaVersion = 3 })
    const [a] = await db.activities.toArray()
    expect(a.effort).toBe(6)
  })

  it('a v4 backup keeps the effort and the exact duration', async () => {
    await ensureSettings()
    await db.activities.add({ date: '2026-10-01', sport: 'City walk', minutes: 46, durationSec: 2745, effort: 7 })
    await roundTrip(() => {})
    const [a] = await db.activities.toArray()
    expect(a.effort).toBe(7)
    expect(activitySec(a)).toBe(2745)
  })

  it('an activity without durationSec falls back to its minutes', () => {
    expect(activitySec({ date: '2026-10-01', sport: 'x', minutes: 45 })).toBe(2700)
  })
})

describe('grid cells with several activities', () => {
  const tEn = (k: StringKey) => strings.en[k]
  it('names every activity of the day', () => {
    expect(gridPartsLabel('2026-09-29', ['weights', 'running', 'other'], 'en', tEn)).toBe('29 Sept 2026: Weights, Running, Other activities')
    expect(gridPartsLabel('2026-09-29', [], 'en', tEn)).toContain('Nothing logged')
  })
})
