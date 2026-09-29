import { db } from './db'
import type { RunLog, RunTemplate } from './types'

// Runs — logs copy their own values, so editing a shoe name or template never rewrites history.

export const listRuns = () => db.runs.orderBy('date').reverse().toArray()

export const addRun = (run: Omit<RunLog, 'id'>) => db.runs.add(run)

export const updateRun = (id: number, patch: Partial<Omit<RunLog, 'id'>>) => db.runs.update(id, patch)

export const deleteRun = (id: number) => db.runs.delete(id)

// Shoes — the distance in the app is always summed from runs, never stored; only the distance before the app is.

export const listShoes = () => db.shoes.orderBy('id').toArray()

export const addShoe = (name: string, startKm = 0) => db.shoes.add({ name, retired: false, ...(startKm > 0 ? { startKm } : {}) })

/** Sets the distance run before the app (0 clears it). */
export const setShoeStartKm = (id: number, startKm: number) => db.shoes.update(id, { startKm: startKm > 0 ? startKm : undefined })

export const renameShoe = (id: number, name: string) => db.shoes.update(id, { name })

export const setShoeRetired = (id: number, retired: boolean) => db.shoes.update(id, { retired })

/** A pair is used once any run references it. */
export const shoeInUse = async (id: number) => (await db.runs.where('shoeId').equals(id).count()) > 0

/** Deletes a pair only when no run uses it; used pairs are retired instead (the UI enforces this). */
export async function deleteShoe(id: number) {
  return db.transaction('rw', [db.shoes, db.runs], async () => {
    if (await shoeInUse(id)) return false
    await db.shoes.delete(id)
    return true
  })
}

// Run templates — applying one only pre-fills a new run's plan.

export const listTemplates = () => db.runTemplates.orderBy('name').toArray()

export const addTemplate = (t: Omit<RunTemplate, 'id'>) => db.runTemplates.add(t)

export const renameTemplate = (id: number, name: string) => db.runTemplates.update(id, { name })

export const deleteTemplate = (id: number) => db.runTemplates.delete(id)
