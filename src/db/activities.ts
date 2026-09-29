import { db } from './db'
import type { Activity } from './types'

export const listActivities = () => db.activities.orderBy('date').reverse().toArray()

/** Past sport names for autocomplete suggestions (unique, case-insensitive, sorted). */
export async function listSportSuggestions(): Promise<string[]> {
  const all = await db.activities.orderBy('sport').uniqueKeys()
  return all as string[]
}

export const addActivity = (a: Omit<Activity, 'id'>) => db.activities.add(a)

export const updateActivity = (id: number, patch: Partial<Omit<Activity, 'id'>>) =>
  db.activities.update(id, patch)

export const deleteActivity = (id: number) => db.activities.delete(id)

export const listActivitiesByRange = (from: string, to: string) =>
  db.activities.where('date').between(from, to, true, true).toArray()
