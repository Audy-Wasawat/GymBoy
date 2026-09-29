import { db } from './db'
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

export const updateFood = (id: number, patch: Partial<Omit<Food, 'id'>>) => db.foods.update(id, patch)

/** Deleting a library food never changes past entries (entries store their own name/kcal/protein). */
export const deleteFood = (id: number) => db.foods.delete(id)

// Food entries (daily log)

export const listFoodEntries = (date: string) =>
  db.foodEntries.where('date').equals(date).sortBy('time')

export async function listFoodEntriesByRange(from: string, to: string): Promise<FoodEntry[]> {
  return db.foodEntries.where('date').between(from, to, true, true).sortBy('time')
}

export const addFoodEntry = (entry: Omit<FoodEntry, 'id'>) => db.foodEntries.add(entry)

export const updateFoodEntry = (id: number, patch: Partial<Omit<FoodEntry, 'id'>>) =>
  db.foodEntries.update(id, patch)

export const deleteFoodEntry = (id: number) => db.foodEntries.delete(id)
