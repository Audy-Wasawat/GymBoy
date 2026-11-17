import { db } from './db'
import { prunePhotos } from './photoStore'
import type { Food, FoodEntry } from './types'

// Food library

export const listFoods = () => db.foods.orderBy('name').toArray()

/** Most-recently-used foods first, then alphabetical for the rest. */
export async function listFoodsMRU(): Promise<Food[]> {
  const allEntries = await db.foodEntries.toArray()
  const recent = allEntries.sort((a, b) => b.time - a.time).slice(0, 200)
  const foods = await db.foods.orderBy('name').toArray()
  const seen = new Set<number>()
  const mruIds: number[] = []
  for (const e of recent) {
    if (e.foodId != null && !seen.has(e.foodId)) { seen.add(e.foodId); mruIds.push(e.foodId) }
  }
  const byId = new Map(foods.map((f) => [f.id!, f]))
  const mru = mruIds.map((id) => byId.get(id)).filter(Boolean) as Food[]
  const rest = foods.filter((f) => !seen.has(f.id!))
  return [...mru, ...rest]
}

export const addFood = (food: Omit<Food, 'id'>) => db.foods.add(food)

/** A new library photo gets a new key, so entries that linked the old one keep showing it. */
export async function updateFood(id: number, patch: Partial<Omit<Food, 'id'>>) {
  await db.foods.update(id, patch)
  await prunePhotos()
}

/** Deleting a library food never changes past entries (entries store their own name/kcal/protein and photo link). */
export async function deleteFood(id: number) {
  await db.foods.delete(id)
  await prunePhotos()
}

// Food entries (daily log)

export const listFoodEntries = (date: string) =>
  db.foodEntries.where('date').equals(date).sortBy('time')

export async function listFoodEntriesByRange(from: string, to: string): Promise<FoodEntry[]> {
  return db.foodEntries.where('date').between(from, to, true, true).sortBy('time')
}

export const addFoodEntry = (entry: Omit<FoodEntry, 'id'>) => db.foodEntries.add(entry)

/**
 * Adds a new entry linked to a stored photo (see photoStore). With `library`, the food is also saved
 * to the library with the same photo and the entry is linked to it. Later library edits or deletes
 * never touch the entry: it keeps its own name, values and photo link.
 */
export async function saveNewFoodEntry(
  entry: Omit<FoodEntry, 'id' | 'photo' | 'photoKey'>, photoKey: string | undefined, library?: Omit<Food, 'id' | 'photo' | 'photoKey'>
) {
  return db.transaction('rw', [db.foods, db.foodEntries], async () => {
    const foodId = library ? await db.foods.add({ ...library, ...(photoKey ? { photoKey } : {}) }) : entry.foodId
    return db.foodEntries.add({ ...entry, foodId, ...(photoKey ? { photoKey } : {}) })
  })
}

export async function updateFoodEntry(id: number, patch: Partial<Omit<FoodEntry, 'id'>>) {
  await db.foodEntries.update(id, patch)
  await prunePhotos()
}

export async function deleteFoodEntry(id: number) {
  await db.foodEntries.delete(id)
  await prunePhotos()
}
