import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSettings } from '../db/db'
import { resetDb } from '../test/resetDb'
import { storePhoto } from '../db/photoStore'
import {
  backupFilename, BackupTooNewError, createBackup, parseBackup, restoreBackup, restoreWithUndo, undoRestore
} from './backup'

beforeEach(resetDb)

const photo = (n: number) => new Blob([new Uint8Array(n).fill(7)], { type: 'image/jpeg' })
/** The size of the picture a food or entry shows. */
const shownSize = async (row?: { photoKey?: string }) => (row?.photoKey ? (await db.photos.get(row.photoKey))?.blob.size : undefined)
const asFile = (blob: Blob) => new File([blob], 'b.json', { type: 'application/json' })

async function seed() {
  await ensureSettings()
  await db.foods.add({ id: 1, name: 'Rice', kcal: 300, proteinG: 6, photoKey: await storePhoto(photo(500)) })
  await db.foodEntries.add({ id: 1, date: '2026-11-01', time: 1, name: 'Rice', portion: 1, kcal: 300, proteinG: 6, photoKey: await storePhoto(photo(400)) })
  await db.bodyEntries.add({ id: 1, date: '2026-11-01', weightKg: 70, photos: [{ blob: photo(300), pose: 'front' }] })
  await db.runs.add({ date: '2026-11-01', distanceKm: 5, durationSec: 1800 })
}

describe('backups with and without photos', () => {
  it('a file without photos is valid, says so, and is much smaller', async () => {
    await seed()
    const full = await createBackup({ photos: true })
    const small = await createBackup({ photos: false })
    expect(small.size).toBeLessThan(full.size)
    const { counts } = await parseBackup(asFile(small))
    expect(counts).toMatchObject({ photosExcluded: true, photos: 0, runs: 1, foodEntries: 1, bodyEntries: 1 })
    const withPhotos = await parseBackup(asFile(full))
    expect(withPhotos.counts).toMatchObject({ photosExcluded: false, photos: 3 })
    expect(typeof withPhotos.counts.exportedAt).toBe('string')
  })

  it('restoring a file without photos keeps the photos this phone already has', async () => {
    await seed()
    const { data } = await parseBackup(asFile(await createBackup({ photos: false })))
    await restoreBackup(data)
    expect(await shownSize(await db.foods.get(1))).toBe(500)
    expect(await shownSize(await db.foodEntries.get(1))).toBe(400)
    expect((await db.bodyEntries.get(1))?.photos?.[0].blob.size).toBe(300)
  })

  it('a full backup restores photos on an empty phone', async () => {
    await seed()
    const { data } = await parseBackup(asFile(await createBackup({ photos: true })))
    await resetDb()
    const { photosLost } = await restoreBackup(data)
    expect(photosLost).toBe(0)
    expect(await shownSize(await db.foodEntries.get(1))).toBe(400)
    expect((await db.bodyEntries.get(1))?.photos?.length).toBe(1)
  })

  it('reports damaged photos instead of dropping them silently', async () => {
    await seed()
    const json = JSON.parse(await (await createBackup({ photos: true })).text())
    json.photoStore[0].photo = 'data:image/jpeg;base64,@@@not base64@@@'
    const { data } = await parseBackup(new File([JSON.stringify(json)], 'b.json'))
    await resetDb()
    expect((await restoreBackup(data)).photosLost).toBe(1)
  })

  it('a file from a newer app version is told apart from a broken file', async () => {
    await seed()
    const json = JSON.parse(await (await createBackup({ photos: false })).text())
    json.schemaVersion = 99
    await expect(parseBackup(new File([JSON.stringify(json)], 'b.json'))).rejects.toBeInstanceOf(BackupTooNewError)
    await expect(parseBackup(new File(['{"format":"nope"}'], 'b.json'))).rejects.not.toBeInstanceOf(BackupTooNewError)
  })
})

describe('undoing a restore', () => {
  it('keeps a copy of the data before a restore and puts it back on undo', async () => {
    await seed()
    // A backup from an "old phone" with a different run.
    const other = JSON.parse(await (await createBackup({ photos: false })).text())
    other.runs = [{ id: 50, date: '2026-10-01', distanceKm: 21.1, durationSec: 7200 }]
    const { data } = await parseBackup(new File([JSON.stringify(other)], 'b.json'))

    await restoreWithUndo(data)
    expect((await db.runs.toArray()).map((r) => r.distanceKm)).toEqual([21.1])
    expect(await db.restorePoints.count()).toBe(1)

    expect(await undoRestore()).toBe(true)
    expect((await db.runs.toArray()).map((r) => r.distanceKm)).toEqual([5])
    expect(await shownSize(await db.foodEntries.get(1))).toBe(400)
  })

  it('makes no copy on a fresh phone with nothing logged', async () => {
    await ensureSettings()
    await db.runs.add({ date: '2026-11-01', distanceKm: 5, durationSec: 1800 })
    const { data } = await parseBackup(asFile(await createBackup({ photos: false })))
    await resetDb()
    await ensureSettings()
    await restoreWithUndo(data)
    expect(await db.restorePoints.count()).toBe(0)
  })
})

describe('backup file names', () => {
  it('carry the time, and say when photos are left out', () => {
    const at = new Date(2026, 10, 17, 8, 5)
    expect(backupFilename(true, at)).toBe('gymboy-backup-2026-11-17-0805.json')
    expect(backupFilename(false, at)).toBe('gymboy-backup-2026-11-17-0805-no-photos.json')
  })
})
