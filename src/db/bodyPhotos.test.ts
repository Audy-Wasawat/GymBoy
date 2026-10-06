import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { db } from './db'

describe('body photos, schema v3', () => {
  it('moves the single photo of an older entry into photos as a front photo', async () => {
    db.close()
    await Dexie.delete('gymboy')
    // The database as version 2 left it: one `photo` Blob per body entry.
    const old = new Dexie('gymboy')
    old.version(2).stores({ bodyEntries: '++id, date' })
    await old.open()
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    await old.table('bodyEntries').bulkAdd([
      { date: '2026-09-01', weightKg: 72, photo: blob },
      { date: '2026-09-02', weightKg: 71 }
    ])
    old.close()

    await db.open()
    const [a, b] = await db.bodyEntries.orderBy('date').toArray()
    expect(a.photos?.map((p) => p.pose)).toEqual(['front'])
    expect(new Uint8Array(await a.photos![0].blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect('photo' in a).toBe(false)
    expect(b.photos).toBeUndefined()
  })
})
