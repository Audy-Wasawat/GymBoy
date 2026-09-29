import { db } from './db'
import type { BodyEntry } from './types'

export const listBodyEntries = () => db.bodyEntries.orderBy('date').reverse().toArray()

export const addBodyEntry = (e: Omit<BodyEntry, 'id'>) => db.bodyEntries.add(e)

export const updateBodyEntry = (id: number, patch: Partial<Omit<BodyEntry, 'id'>>) =>
  db.bodyEntries.update(id, patch)

export const deleteBodyEntry = (id: number) => db.bodyEntries.delete(id)

export const listBodyEntriesByRange = (from: string, to: string) =>
  db.bodyEntries.where('date').between(from, to, true, true).sortBy('date')
