import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { resetDb } from '../test/resetDb'
import {
  addRun, addShoe, addTemplate, deleteRun, deleteShoe, deleteTemplate,
  listRuns, listShoes, listTemplates, renameShoe, renameTemplate, setShoeRetired, shoeInUse, updateRun
} from './runs'

beforeEach(resetDb)

describe('runs', () => {
  it('lists newest first and edits copy no external values', async () => {
    await addRun({ date: '2026-09-20', type: 'easy', distanceKm: 5, durationSec: 1500 })
    await addRun({ date: '2026-09-28', type: 'tempo', distanceKm: 8, durationSec: 2000 })
    const runs = await listRuns()
    expect(runs.map((r) => r.date)).toEqual(['2026-09-28', '2026-09-20'])

    await updateRun(runs[0].id!, { distanceKm: 9 })
    expect((await db.runs.get(runs[0].id!))!.distanceKm).toBe(9)

    await deleteRun(runs[0].id!)
    expect(await listRuns()).toHaveLength(1)
  })
})

describe('shoes', () => {
  it('sums nothing until runs exist and blocks deleting a used pair', async () => {
    const id = (await addShoe('Vaporfly')) as number
    expect(await shoeInUse(id)).toBe(false)
    expect(await deleteShoe(id)).toBe(true)
    expect(await listShoes()).toHaveLength(0)

    const id2 = (await addShoe('Pegasus')) as number
    await addRun({ date: '2026-09-28', type: 'easy', distanceKm: 5, durationSec: 1500, shoeId: id2 })
    expect(await shoeInUse(id2)).toBe(true)
    // A used pair cannot be deleted; it is retired instead.
    expect(await deleteShoe(id2)).toBe(false)
    expect(await listShoes()).toHaveLength(1)

    await setShoeRetired(id2, true)
    expect((await db.shoes.get(id2))!.retired).toBe(true)
    await renameShoe(id2, 'Pegasus 40')
    expect((await db.shoes.get(id2))!.name).toBe('Pegasus 40')
  })
})

describe('templates', () => {
  it('creates, renames and deletes without touching runs', async () => {
    const id = (await addTemplate({ name: '6x800', type: 'interval', plan: { reps: 6, distanceM: 800, restSec: 90 } })) as number
    expect(await listTemplates()).toHaveLength(1)
    await renameTemplate(id, '6x800 @3:40')
    expect((await listTemplates())[0].name).toBe('6x800 @3:40')
    await deleteTemplate(id)
    expect(await listTemplates()).toHaveLength(0)
  })
})
