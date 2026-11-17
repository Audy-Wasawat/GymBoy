import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addFood, addFoodEntry, deleteFood, saveNewFoodEntry, updateFood, updateFoodEntry } from './food'
import { addBodyEntry } from './body'
import { aiExportFilename, blobToDataUrl, clearHistory, createAIExport, createBackup, dataUrlToBlob, parseBackup, restoreBackup } from '../lib/backup'
import { compressionSteps, fitDimensions, PHOTO_TARGET_BYTES } from '../lib/photos'
import { migrateFoodPhotos, photoKeyOf, storePhoto } from './photoStore'
import { resetDb } from '../test/resetDb'

beforeEach(resetDb)

// A small fake "photo": recognisable bytes, including values above 127.
const photo = (seed: number, size = 300) =>
  new Blob([Uint8Array.from({ length: size }, (_, i) => (i * 7 + seed) % 256)], { type: 'image/jpeg' })
const bytes = async (b?: Blob) => (b ? Array.from(new Uint8Array(await b.arrayBuffer())) : undefined)

/** The picture a food or entry shows: from the store, or its old per-row copy. */
const shown = async (row?: { photoKey?: string; photo?: Blob }) =>
  row?.photoKey ? (await db.photos.get(row.photoKey))?.blob : row?.photo

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
    const foodKey = await storePhoto(photo(1))
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photoKey: foodKey })
    const entryId = await addFoodEntry({ ...entry(), foodId, photoKey: await storePhoto(photo(2)) })
    const bodyId = await addBodyEntry({ date: '2026-09-29', weightKg: 70, photos: [{ blob: photo(3), pose: 'front' }, { blob: photo(4), pose: 'side' }] })
    const json = await roundTrip()
    // Food photos are written once each in photoStore, as data URLs, never as the {} JSON makes of a Blob.
    expect(json.photoStore).toHaveLength(2)
    expect(json.photoStore).toEqual(expect.arrayContaining([expect.objectContaining({ photo: expect.stringMatching(/^data:image\/jpeg;base64,/) })]))
    expect(json.foodEntries).toEqual([expect.objectContaining({ photoKey: expect.any(String) })])
    expect(JSON.stringify(json.foodEntries)).not.toContain('data:')
    expect(JSON.stringify(json)).not.toContain('"photo":{}')

    expect(await bytes(await shown(await db.foodEntries.get(entryId)))).toEqual(await bytes(photo(2)))
    expect(await bytes(await shown(await db.foods.get(foodId)))).toEqual(await bytes(photo(1)))
    const body = (await db.bodyEntries.get(bodyId))!
    expect(body.photos?.map((p) => p.pose)).toEqual(['front', 'side'])
    expect(await bytes(body.photos![0].blob)).toEqual(await bytes(photo(3)))
    expect(await bytes(body.photos![1].blob)).toEqual(await bytes(photo(4)))
  })

  it('a photo used by a library food and many entries is stored and written once', async () => {
    const key = await storePhoto(photo(1))
    const foodId = await addFood({ name: 'Boiled egg', kcal: 70, proteinG: 6, photoKey: key })
    for (let i = 0; i < 30; i++) await saveNewFoodEntry({ ...entry(), foodId, time: i }, key)
    expect(await db.photos.count()).toBe(1)
    const json = await roundTrip()
    expect(json.photoStore).toHaveLength(1)
    expect(await db.photos.count()).toBe(1)
    expect(new Set((await db.foodEntries.toArray()).map((e) => e.photoKey))).toEqual(new Set([key]))
  })

  it('an old backup that copied a photo into every row restores as one stored photo', async () => {
    const json = JSON.parse(await (await createBackup()).text())
    const url = await blobToDataUrl(photo(9))
    json.schemaVersion = 4
    delete json.photoStore
    json.foods = [{ id: 1, name: 'Toast', kcal: 80, proteinG: 3, photo: url }]
    json.foodEntries = [1, 2, 3].map((i) => ({ id: i, date: '2026-09-29', time: i, foodId: 1, name: 'Toast', portion: 1, kcal: 80, proteinG: 3, photo: url }))
    const { data } = await parseBackup(new File([JSON.stringify(json)], 'b.json'))
    await restoreBackup(data)
    expect(await db.photos.count()).toBe(1)
    for (const e of await db.foodEntries.toArray()) {
      expect('photo' in e).toBe(false)
      expect(await bytes(await shown(e))).toEqual(await bytes(photo(9)))
    }
  })

  it('turns the single photo of an older backup into a front photo', async () => {
    const id = await addBodyEntry({ date: '2026-09-29', weightKg: 70 })
    const json = JSON.parse(await (await createBackup()).text())
    json.schemaVersion = 2
    json.bodyEntries[0].photo = await blobToDataUrl(photo(5))
    await restoreBackup(json)
    const e = (await db.bodyEntries.get(id))!
    expect(e.photos?.map((p) => p.pose)).toEqual(['front'])
    expect(await bytes(e.photos![0].blob)).toEqual(await bytes(photo(5)))
    expect('photo' in e).toBe(false)
  })

  it('an entry without a photo stays without one', async () => {
    const id = await addFoodEntry(entry())
    await roundTrip()
    const e = (await db.foodEntries.get(id))!
    expect('photo' in e || 'photoKey' in e).toBe(false)
  })

  it('restores an older backup whose entries have no photo field at all', async () => {
    const id = await addFoodEntry(entry())
    await roundTrip((json) => { for (const e of json.foodEntries as Record<string, unknown>[]) delete e.photo })
    expect((await db.foodEntries.get(id))?.name).toBe('Rice')
  })

  it('drops a photo that a broken backup holds as {} instead of storing garbage', async () => {
    const id = await addFoodEntry(entry())
    await roundTrip((json) => { json.schemaVersion = 4; for (const e of json.foodEntries as Record<string, unknown>[]) e.photo = {} })
    const e = (await db.foodEntries.get(id))!
    expect(e.photo).toBeUndefined()
    expect(e.photoKey).toBeUndefined()
    expect(e.name).toBe('Rice')
  })
})

describe('food photos are linked, not copied', () => {
  it('picking a library food links its photo, and the entry keeps it when the food is deleted', async () => {
    const key = await storePhoto(photo(5))
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photoKey: key })
    const id = await saveNewFoodEntry({ ...entry(), foodId }, key)
    expect(await db.photos.count()).toBe(1)
    await deleteFood(foodId)
    expect(await bytes(await shown(await db.foodEntries.get(id)))).toEqual(await bytes(photo(5)))
  })

  it('a new library photo leaves earlier entries showing the old one', async () => {
    const oldKey = await storePhoto(photo(5))
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photoKey: oldKey })
    const id = await saveNewFoodEntry({ ...entry(), foodId }, oldKey)
    await updateFood(foodId, { photoKey: await storePhoto(photo(6)), kcal: 999 })
    expect(await bytes(await shown(await db.foodEntries.get(id)))).toEqual(await bytes(photo(5)))
    expect(await bytes(await shown(await db.foods.get(foodId)))).toEqual(await bytes(photo(6)))
    expect((await db.foodEntries.get(id))?.kcal).toBe(200)
    expect(await db.photos.count()).toBe(2)
  })

  it('a photo added to one entry belongs to that entry only', async () => {
    const libKey = await storePhoto(photo(5))
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photoKey: libKey })
    const a = await saveNewFoodEntry({ ...entry(), foodId }, libKey)
    const b = await saveNewFoodEntry({ ...entry(), foodId, time: 2 }, await storePhoto(photo(8)))
    expect(await bytes(await shown(await db.foodEntries.get(a)))).toEqual(await bytes(photo(5)))
    expect(await bytes(await shown(await db.foodEntries.get(b)))).toEqual(await bytes(photo(8)))
    expect(await bytes(await shown(await db.foods.get(foodId)))).toEqual(await bytes(photo(5)))
  })

  it('a one-off food saved to the library shares one photo with its entry', async () => {
    const id = await saveNewFoodEntry(entry(), await storePhoto(photo(7)), { name: 'Rice', kcal: 200, proteinG: 4 })
    const e = (await db.foodEntries.get(id))!
    const f = (await db.foods.get(e.foodId!))!
    expect(f.photoKey).toBe(e.photoKey)
    expect(await db.photos.count()).toBe(1)
  })

  it('a one-off food without "save to library" stays out of the library', async () => {
    await saveNewFoodEntry(entry(), await storePhoto(photo(7)))
    expect(await db.foods.count()).toBe(0)
  })

  it('an entry photo can be replaced and removed, and a photo nothing uses is cleaned up', async () => {
    const id = await addFoodEntry({ ...entry(), photoKey: await storePhoto(photo(1)) })
    await updateFoodEntry(id, { name: 'Rice', photoKey: await storePhoto(photo(2)) })
    expect(await bytes(await shown(await db.foodEntries.get(id)))).toEqual(await bytes(photo(2)))
    expect(await db.photos.count()).toBe(1)
    await updateFoodEntry(id, { name: 'Rice', photoKey: undefined })
    expect((await db.foodEntries.get(id))?.photoKey).toBeUndefined()
    expect(await db.photos.count()).toBe(0)
    // Editing other fields leaves a photo alone.
    await updateFoodEntry(id, { photoKey: await storePhoto(photo(3)) })
    await updateFoodEntry(id, { kcal: 250 })
    expect(await bytes(await shown(await db.foodEntries.get(id)))).toEqual(await bytes(photo(3)))
  })

  it("clearing food history removes the entries' photos and keeps the library's", async () => {
    const foodId = await addFood({ name: 'Rice', kcal: 200, proteinG: 4, photoKey: await storePhoto(photo(1)) })
    await addFoodEntry({ ...entry(), foodId, photoKey: await storePhoto(photo(2)) })
    await addFoodEntry({ ...entry('2026-09-28'), photoKey: await storePhoto(photo(3)) })
    await clearHistory(new Set(['food']))
    expect(await db.foodEntries.count()).toBe(0)
    expect(await db.photos.count()).toBe(1)
    expect(await bytes(await shown(await db.foods.get(foodId)))).toEqual(await bytes(photo(1)))
  })

  it('the AI export never carries photos', async () => {
    await addFoodEntry({ ...entry(), photoKey: await storePhoto(photo(2)) })
    await addBodyEntry({ date: '2026-09-29', weightKg: 70, photos: [{ blob: photo(3), pose: 'back' }] })
    const text = await (await createAIExport({
      from: '2026-09-01', to: '2026-09-30', categories: new Set(['food', 'body'])
    })).text()
    expect(text).not.toMatch(/data:image|base64/i)
    expect(aiExportFilename('a', 'b')).toContain('export')
  })
})

describe('moving photos saved before the photo store', () => {
  it('moves per-row copies into the store, once per picture, without changing a byte', async () => {
    // The old layout: the library photo copied into every entry, plus one entry with its own photo.
    const foodId = await db.foods.add({ name: 'Egg', kcal: 70, proteinG: 6, photo: photo(1) })
    const ids = []
    for (let i = 0; i < 5; i++) ids.push(await db.foodEntries.add({ ...entry(), time: i, foodId, name: 'Egg', photo: photo(1) }))
    const own = await db.foodEntries.add({ ...entry(), time: 9, photo: photo(4) })
    const plain = await db.foodEntries.add({ ...entry(), time: 10 })

    await migrateFoodPhotos()
    expect(await db.photos.count()).toBe(2)
    for (const id of [...ids, own, plain]) expect('photo' in (await db.foodEntries.get(id))!).toBe(false)
    for (const id of ids) expect(await bytes(await shown(await db.foodEntries.get(id)))).toEqual(await bytes(photo(1)))
    expect(await bytes(await shown(await db.foodEntries.get(own)))).toEqual(await bytes(photo(4)))
    expect(await bytes(await shown(await db.foods.get(foodId)))).toEqual(await bytes(photo(1)))
    expect((await db.foodEntries.get(plain))?.photoKey).toBeUndefined()

    // Running again changes nothing.
    await migrateFoodPhotos()
    expect(await db.photos.count()).toBe(2)
  })

  it('the same picture always gets the same key', async () => {
    expect(await photoKeyOf(photo(1))).toBe(await photoKeyOf(photo(1)))
    expect(await photoKeyOf(photo(1))).not.toBe(await photoKeyOf(photo(2)))
    expect(await photoKeyOf(photo(1, 300))).not.toBe(await photoKeyOf(photo(1, 301)))
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
