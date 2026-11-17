import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

/**
 * A key for a photo made from its bytes, so the same picture always gets the same key, on any phone.
 * Two independent 32-bit hashes plus the size: an accidental clash is not a practical concern for a
 * personal photo collection. (crypto.subtle is not used: it is missing on plain-http LAN testing.)
 */
export async function photoKeyOf(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let h1 = 0xdeadbeef ^ bytes.length
  let h2 = 0x41c6ce57 ^ bytes.length
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    h1 = Math.imul(h1 ^ b, 2654435761)
    h2 = Math.imul(h2 ^ b, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  return `${bytes.length.toString(36)}-${hex(h1)}${hex(h2)}`
}

/** Stores a photo (once: an identical picture already stored is reused) and returns its key. */
export async function storePhoto(blob: Blob): Promise<string> {
  const key = await photoKeyOf(blob)
  if (!(await db.photos.get(key))) await db.photos.put({ key, blob })
  return key
}

export const loadPhoto = async (key?: string) => (key ? (await db.photos.get(key))?.blob : undefined)

/** The photo of a food or entry: from the store, or the old per-row copy until it has been moved. */
export function useRowPhoto(row?: { photoKey?: string; photo?: Blob } | null): Blob | undefined {
  const key = row?.photoKey
  const legacy = row?.photo
  return useLiveQuery(async () => (key ? loadPhoto(key) : legacy), [key, legacy])
}

/** Deletes stored photos that no food or entry points to any more. */
export async function prunePhotos(): Promise<number> {
  return db.transaction('rw', [db.photos, db.foods, db.foodEntries], async () => {
    const [foods, entries, keys] = await Promise.all([db.foods.toArray(), db.foodEntries.toArray(), db.photos.toCollection().primaryKeys()])
    const used = new Set([...foods, ...entries].map((r) => r.photoKey).filter(Boolean))
    const unused = keys.filter((k) => !used.has(k))
    await db.photos.bulkDelete(unused)
    return unused.length
  })
}

/**
 * Moves food photos from the old layout (a Blob copied into every row) into the photo store. Copies
 * of the same picture end up as one stored photo. Safe to run any number of times and to be
 * interrupted: a row only loses its old copy in the same step that points it at the stored one.
 */
export async function migrateFoodPhotos(): Promise<void> {
  const [foods, entries] = await Promise.all([
    db.foods.filter((f) => f.photo instanceof Blob).toArray(),
    db.foodEntries.filter((e) => e.photo instanceof Blob).toArray()
  ])
  if (!foods.length && !entries.length) return
  // Bytes are read outside any transaction (IndexedDB transactions cannot wait for them).
  const keyed = async <T extends { id?: number; photo?: Blob }>(rows: T[]) =>
    Promise.all(rows.map(async (r) => ({ id: r.id!, blob: r.photo!, key: await photoKeyOf(r.photo!) })))
  const [f, e] = await Promise.all([keyed(foods), keyed(entries)])
  await db.transaction('rw', [db.photos, db.foods, db.foodEntries], async () => {
    const stored = new Set(await db.photos.toCollection().primaryKeys())
    for (const x of [...f, ...e]) {
      if (!stored.has(x.key)) { await db.photos.put({ key: x.key, blob: x.blob }); stored.add(x.key) }
    }
    for (const x of f) await db.foods.where('id').equals(x.id).modify((r) => { r.photoKey = x.key; delete r.photo })
    for (const x of e) await db.foodEntries.where('id').equals(x.id).modify((r) => { r.photoKey = x.key; delete r.photo })
  })
}

/** A photo chosen on an editor screen: an existing stored one (key) or a newly taken one (blob). */
export interface PhotoPick { key?: string; blob?: Blob }

/** The blob to show for a pick. */
export function usePickedPhoto(pick: PhotoPick): Blob | undefined {
  const stored = useLiveQuery(async () => (pick.blob ? undefined : loadPhoto(pick.key)), [pick.key, pick.blob])
  return pick.blob ?? stored
}

/** The store key for a pick on save: an existing key is linked as it is, a new photo is stored (once). */
export const resolvePhotoKey = async (pick: PhotoPick) => pick.key ?? (pick.blob ? storePhoto(pick.blob) : undefined)
