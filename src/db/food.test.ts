import { beforeEach, describe, expect, it } from 'vitest'
import { addFood, addFoodEntry, listFoodEntries, listFoodsMRU, updateFood, deleteFood } from './food'
import { db } from './db'
import { resetDb } from '../test/resetDb'

beforeEach(resetDb)

describe('food library', () => {
  it('adds and lists foods alphabetically', async () => {
    await addFood({ name: 'Rice', kcal: 200, proteinG: 4 })
    await addFood({ name: 'Egg', kcal: 70, proteinG: 6 })
    const foods = await db.foods.orderBy('name').toArray()
    expect(foods.map((f) => f.name)).toEqual(['Egg', 'Rice'])
  })

  it('update food changes values', async () => {
    const id = await addFood({ name: 'Oats', kcal: 300, proteinG: 10 })
    await updateFood(id, { kcal: 350 })
    const food = await db.foods.get(id)
    expect(food?.kcal).toBe(350)
    expect(food?.name).toBe('Oats')
  })

  it('delete food removes it', async () => {
    const id = await addFood({ name: 'Temp', kcal: 100, proteinG: 2 })
    await deleteFood(id)
    const food = await db.foods.get(id)
    expect(food).toBeUndefined()
  })
})

describe('food entries', () => {
  it('lists entries for a date', async () => {
    await addFoodEntry({ date: '2026-01-15', time: 1000, name: 'Egg', portion: 1, kcal: 70, proteinG: 6 })
    await addFoodEntry({ date: '2026-01-16', time: 2000, name: 'Rice', portion: 1, kcal: 200, proteinG: 4 })
    const entries = await listFoodEntries('2026-01-15')
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('Egg')
  })

  it('mru puts recently used foods first', async () => {
    const ricId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4 })
    const eggId = await addFood({ name: 'Egg', kcal: 70, proteinG: 6 })
    // Use Rice first, then Egg later
    await addFoodEntry({ date: '2026-01-10', time: 1000, foodId: ricId, name: 'Rice', portion: 1, kcal: 200, proteinG: 4 })
    await addFoodEntry({ date: '2026-01-11', time: 2000, foodId: eggId, name: 'Egg', portion: 1, kcal: 70, proteinG: 6 })
    const mru = await listFoodsMRU()
    expect(mru[0].name).toBe('Egg')
    expect(mru[1].name).toBe('Rice')
  })
})
