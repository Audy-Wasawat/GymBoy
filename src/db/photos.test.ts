import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addFood, addFoodEntry, deleteFood, saveNewFoodEntry, updateFood, updateFoodEntry } from './food'
import { addBodyEntry } from './body'
import { aiExportFilename, blobToDataUrl, clearHistory, createAIExport, createBackup, dataUrlToBlob, parseBackup, restoreBackup } from '../lib/backup'
import { compressionSteps, fitDimensions, PHOTO_TARGET_BYTES } from '../lib/photos'
import { resetDb } from '../test/resetDb'

beforeEach(resetDb)

// A small fake "photo": recognisable bytes, including values above 127.
const photo = (seed: number, size = 300) =>
  new Blob([Uint8Array.from({ length: size }, (_, i) => (i * 7 + seed) % 256)], { type: 'image/jpeg' })
const bytes = async (b?: Blob) => (b ? Array.from(new Uint8Array(await b.arrayBuffer())) : undefined)

const entry = (date = '2026-09-29') => ({ date, time: 1, name: 'Rice', portion: 1, kcal: 200, proteinG: 4 })

async function roundTrip(edit?: (json: Record<string, unknown>) => void) {
  const json = JSON.parse(await (await createBackup()).text())
  edit?.(json)
  const { data } = await parseBackup(new File([JSON.stringify(json)], 'b.json'))
  await restoreBackup(data)
  return json
}

describe('photo data URLs', () => {
  it('turn a blob into a data URL and back without changing a byte', async () => {
    const b = photo(3, 100000)
    const url = await blobToDataUrl(b)
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true)
    const back = dataUrlToBlob(url)
    expect(back.type).toBe('image/jpeg')
    expect(await bytes(back)).toEqual(await bytes(b))
  })
})

describe('backup and restore with photos (F1)', () => {
  it('keeps the photo of a food entry, a library food and a body entry', async () => {
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photo: photo(1) })
    const entryId = await addFoodEntry({ ...entry(), foodId, photo: photo(2) })
    const bodyId = await addBodyEntry({ date: '2026-09-29', weightKg: 70, photo: photo(3) })
    const json = await roundTrip()
    // The file holds data URLs, never the {} that JSON.stringify makes of a Blob.
    expect(json.foodEntries).toEqual([expect.objectContaining({ photo: expect.stringMatching(/^data:image\/jpeg;base64,/) })])
    expect(JSON.stringify(json)).not.toContain('"photo":{}')

    const e = (await db.foodEntries.get(entryId))!
    expect(e.photo).toBeInstanceOf(Blob)
    expect(await bytes(e.photo)).toEqual(await bytes(photo(2)))
    expect(await bytes((await db.foods.get(foodId))?.photo)).toEqual(await bytes(photo(1)))
    expect(await bytes((await db.bodyEntries.get(bodyId))?.photo)).toEqual(await bytes(photo(3)))
  })

  it('an entry without a photo stays without one', async () => {
    const id = await addFoodEntry(entry())
    await roundTrip()
    expect('photo' in (await db.foodEntries.get(id))!).toBe(false)
  })

  it('restores an older backup whose entries have no photo field at all', async () => {
    const id = await addFoodEntry(entry())
    await roundTrip((json) => { for (const e of json.foodEntries as Record<string, unknown>[]) delete e.photo })
    expect((await db.foodEntries.get(id))?.name).toBe('Rice')
  })

  it('drops a photo that a broken backup holds as {} instead of storing garbage', async () => {
    const id = await addFoodEntry({ ...entry(), photo: photo(4) })
    await roundTrip((json) => { for (const e of json.foodEntries as Record<string, unknown>[]) e.photo = {} })
    const e = (await db.foodEntries.get(id))!
    expect(e.photo).toBeUndefined()
    expect(e.name).toBe('Rice')
  })
})

describe('food photos and the library (F1)', () => {
  it('a library food photo is copied into the entry and the entry keeps it when the food is deleted', async () => {
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photo: photo(5) })
    const food = (await db.foods.get(foodId))!
    const id = await saveNewFoodEntry({ ...entry(), foodId }, food.photo)
    await deleteFood(foodId)
    expect(await bytes((await db.foodEntries.get(id))?.photo)).toEqual(await bytes(photo(5)))
  })

  it('editing the library photo does not change past entries', async () => {
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photo: photo(5) })
    const id = await saveNewFoodEntry({ ...entry(), foodId }, photo(5))
    await updateFood(foodId, { photo: photo(6), kcal: 999 })
    expect(await bytes((await db.foodEntries.get(id))?.photo)).toEqual(await bytes(photo(5)))
    expect((await db.foodEntries.get(id))?.kcal).toBe(200)
  })

  it('a one-off food saved to the library copies its photo to the library food too', async () => {
    const id = await saveNewFoodEntry(entry(), photo(7), { name: 'Rice', kcal: 200, proteinG: 4 })
    const e = (await db.foodEntries.get(id))!
    const f = (await db.foods.get(e.foodId!))!
    expect(await bytes(f.photo)).toEqual(await bytes(photo(7)))
    expect(await bytes(e.photo)).toEqual(await bytes(photo(7)))
  })

  it('a one-off food without "save to library" stays out of the library', async () => {
    await saveNewFoodEntry(entry(), photo(7))
    expect(await db.foods.count()).toBe(0)
  })

  it('an entry photo can be replaced and removed', async () => {
    const id = await addFoodEntry({ ...entry(), photo: photo(1) })
    await updateFoodEntry(id, { name: 'Rice', photo: photo(2) })
    expect(await bytes((await db.foodEntries.get(id))?.photo)).toEqual(await bytes(photo(2)))
    await updateFoodEntry(id, { name: 'Rice', photo: undefined })
    expect((await db.foodEntries.get(id))?.photo).toBeUndefined()
    // Editing other fields leaves a photo alone.
    await updateFoodEntry(id, { photo: photo(3) })
    await updateFoodEntry(id, { kcal: 250 })
    expect(await bytes((await db.foodEntries.get(id))?.photo)).toEqual(await bytes(photo(3)))
  })

  it('clearing food history removes the entries\' photos and keeps the library\'s', async () => {
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photo: photo(1) })
    await addFoodEntry({ ...entry(), foodId, photo: photo(2) })
    await addFoodEntry({ ...entry('2026-09-28'), photo: photo(3) })
    await clearHistory(new Set(['food']))
    expect(await db.foodEntries.count()).toBe(0)
    expect(await db.foodEntries.filter((e) => !!e.photo).count()).toBe(0)
    expect((await db.foods.get(foodId))?.photo).toBeInstanceOf(Blob)
  })

  it('the AI export never carries photos', async () => {
    await addFoodEntry({ ...entry(), photo: photo(2) })
    await addBodyEntry({ date: '2026-09-29', weightKg: 70, photo: photo(3) })
    const text = await (await createAIExport({
      from: '2026-09-01', to: '2026-09-30', categories: new Set(['food', 'body'])
    })).text()
    expect(text).not.toMatch(/data:image|photo|base64/i)
    expect(aiExportFilename('a', 'b')).toContain('export')
  })
})

describe('keeping photos small (F3)', () => {
  it('scales to the longest side and never enlarges', () => {
    expect(fitDimensions(4000, 3000, 480)).toEqual({ w: 480, h: 360 })
    expect(fitDimensions(3000, 4000, 480)).toEqual({ w: 360, h: 480 })
    expect(fitDimensions(200, 100, 480)).toEqual({ w: 200, h: 100 })
  })

  it('tries the best quality first, then lower qualities, then a smaller picture', () => {
    const steps = compressionSteps(0.75)
    expect(steps[0]).toEqual({ scale: 1, quality: 0.75 })
    expect(steps.map((s) => s.quality).slice(0, 3)).toEqual([0.75, 0.65, 0.55])
    expect(steps.some((s) => s.scale < 1)).toBe(true)
    for (let i = 1; i < steps.length; i++) expect(steps[i].scale <= steps[i - 1].scale).toBe(true)
    for (const s of steps) expect(s.quality).toBeGreaterThanOrEqual(0.45)
  })

  it('aims at about 60 KB per photo', () => {
    expect(PHOTO_TARGET_BYTES).toBe(60 * 1024)
  })
})
