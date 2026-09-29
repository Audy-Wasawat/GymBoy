import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addRun, addShoe, listRuns, listShoes, setShoeStartKm } from './runs'
import { createBackup, parseBackup, restoreBackup } from '../lib/backup'
import { parseStartKm, shoeStartKm, shoeTotals } from '../lib/running'
import { resetDb } from '../test/resetDb'

beforeEach(resetDb)

describe('parseStartKm (E1)', () => {
  it('reads empty as 0, and numbers from 0 up with at most 2 decimals', () => {
    expect(parseStartKm('')).toBe(0)
    expect(parseStartKm('   ')).toBe(0)
    expect(parseStartKm('0')).toBe(0)
    expect(parseStartKm('312')).toBe(312)
    expect(parseStartKm('312.5')).toBe(312.5)
    expect(parseStartKm('312,75')).toBe(312.75)
    expect(parseStartKm(' 12. ')).toBe(12)
  })
  it('rejects negatives, too many decimals and text', () => {
    for (const bad of ['-1', '-0.5', '12.345', 'abc', '1e3', '1.2.3', '100001', '5 km']) expect(parseStartKm(bad), bad).toBeUndefined()
  })
})

describe('shoe totals (E1)', () => {
  const run = (shoeId: number, distanceKm: number) => ({ date: '2026-09-01', type: 'easy' as const, distanceKm, durationSec: 1800, shoeId })

  it('total is the distance before the app plus the logged runs', async () => {
    const id = await addShoe('Pegasus', 250.5)
    const other = await addShoe('Vaporfly')
    await addRun(run(id, 5))
    await addRun(run(id, 10.25))
    await addRun(run(other, 3))
    const runs = await listRuns()
    const shoes = await listShoes()
    expect(shoeTotals(shoes.find((s) => s.id === id)!, runs)).toEqual({ startKm: 250.5, inAppKm: 15.25, totalKm: 265.75 })
    expect(shoeTotals(shoes.find((s) => s.id === other)!, runs)).toEqual({ startKm: 0, inAppKm: 3, totalKm: 3 })
  })

  it('a pair without the field counts as 0 and floating point noise is rounded away', () => {
    expect(shoeStartKm({})).toBe(0)
    expect(shoeStartKm({ startKm: -5 })).toBe(0)
    expect(shoeStartKm({ startKm: Number.NaN })).toBe(0)
    const runs = [run2(1, 0.1), run2(1, 0.2)]
    expect(shoeTotals({ id: 1, startKm: 0.05 }, runs)).toEqual({ startKm: 0.05, inAppKm: 0.3, totalKm: 0.35 })
  })

  it('editing the starting distance changes the total, and 0 clears it', async () => {
    const id = await addShoe('Pegasus')
    await addRun(run(id, 4))
    await setShoeStartKm(id, 100)
    let shoe = (await db.shoes.get(id))!
    expect(shoeTotals(shoe, await listRuns()).totalKm).toBe(104)
    await setShoeStartKm(id, 0)
    shoe = (await db.shoes.get(id))!
    expect(shoe.startKm).toBeUndefined()
    expect(shoeTotals(shoe, await listRuns()).totalKm).toBe(4)
  })
})

function run2(shoeId: number, distanceKm: number) {
  return { date: '2026-09-01', type: 'easy' as const, distanceKm, durationSec: 60, shoeId }
}

describe('backups and the starting distance (E1)', () => {
  const restore = async (blob: Blob) => {
    const { data } = await parseBackup(new File([blob], 'b.json'))
    await restoreBackup(data)
  }

  it('keeps the starting distance through a backup and restore', async () => {
    const id = await addShoe('Pegasus', 312.5)
    await restore(await createBackup())
    expect((await db.shoes.get(id))?.startKm).toBe(312.5)
  })

  it('restores an older backup that has no starting distance', async () => {
    const id = await addShoe('Old pair')
    const json = JSON.parse(await (await createBackup()).text())
    for (const s of json.shoes) delete s.startKm
    await restore(new Blob([JSON.stringify(json)], { type: 'application/json' }))
    const shoe = (await db.shoes.get(id))!
    expect(shoe.name).toBe('Old pair')
    expect(shoeStartKm(shoe)).toBe(0)
  })
})
